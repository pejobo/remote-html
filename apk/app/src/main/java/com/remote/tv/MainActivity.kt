package com.remote.tv

import android.content.res.AssetManager
import android.content.Intent
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import org.json.JSONObject
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.Lifecycle
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket

class MainActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_PLAY_URL = "play_url"
        const val EXTRA_BACKGROUND = "background_after_play"

        // running instance, so shares can be delivered without bringing the app to the front
        @Volatile
        var instance: MainActivity? = null
    }

    private lateinit var webView: WebView
    private lateinit var server: LocalAssetServer
    private var pageLoaded = false
    private var pendingUrl: String? = null
    private var backgroundAfterPlay = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            useWideViewPort = true
            loadWithOverviewMode = true
        }
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                pageLoaded = true
                deliverPendingUrl()
            }
        }
        webView.webChromeClient = WebChromeClient()
        webView.addJavascriptInterface(object {
            @JavascriptInterface
            fun playUrlDone() = runOnUiThread { onPlayUrlDone() }
        }, "AndroidApp")

        server = LocalAssetServer(assets) { port ->
            runOnUiThread { webView.loadUrl("http://localhost:$port/index.html") }
        }
        server.isDaemon = true
        server.start()

        instance = this
        handleIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val url = intent?.getStringExtra(EXTRA_PLAY_URL) ?: return
        intent.removeExtra(EXTRA_PLAY_URL)
        // cold start by a share: stay in the background once kodi got the url
        backgroundAfterPlay = intent.getBooleanExtra(EXTRA_BACKGROUND, false)
        playUrl(url)
    }

    // called by ShareActivity, also while this activity is in the background
    fun playUrl(url: String) {
        pendingUrl = url
        deliverPendingUrl()
    }

    private fun deliverPendingUrl() {
        val url = pendingUrl ?: return
        if (!pageLoaded) return
        pendingUrl = null
        webView.onResume()
        webView.resumeTimers()
        webView.evaluateJavascript("window.playUrl&&window.playUrl(${JSONObject.quote(url)})", null)
    }

    private fun onPlayUrlDone() {
        if (!lifecycle.currentState.isAtLeast(Lifecycle.State.RESUMED)) webView.onPause()
        if (backgroundAfterPlay) {
            backgroundAfterPlay = false
            moveTaskToBack(true)
        }
    }

    override fun onResume() {
        super.onResume()
        webView.onResume()
        webView.evaluateJavascript(
            "if(typeof connect_to_kodi==='function'){connect_to_kodi();connect_to_tv();}",
            null
        )
    }

    override fun onPause() {
        super.onPause()
        webView.onPause()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (instance === this) instance = null
        server.close()
    }

    override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
        return when (keyCode) {
            KeyEvent.KEYCODE_VOLUME_UP -> {
                webView.evaluateJavascript("window.volumeUp()", null)
                true
            }
            KeyEvent.KEYCODE_VOLUME_DOWN -> {
                webView.evaluateJavascript("window.volumeDown()", null)
                true
            }
            else -> super.onKeyDown(keyCode, event)
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}

private class LocalAssetServer(
    private val assets: AssetManager,
    private val onReady: (Int) -> Unit
) : Thread() {

    private var serverSocket: ServerSocket? = null

    override fun run() {
        val ss = try {
            ServerSocket().also {
                it.reuseAddress = true
                it.bind(InetSocketAddress(8765))
            }
        } catch (_: Exception) {
            ServerSocket(0)
        }
        serverSocket = ss
        onReady(ss.localPort)
        while (!ss.isClosed) {
            try {
                handleRequest(ss.accept())
            } catch (_: Exception) {
                break
            }
        }
    }

    private fun handleRequest(socket: Socket) {
        Thread {
            socket.use {
                val line = BufferedReader(InputStreamReader(it.inputStream)).readLine() ?: return@Thread
                val parts = line.split(" ")
                if (parts.size < 2) return@Thread
                val path = parts[1].removePrefix("/").ifEmpty { "index.html" }.substringBefore("?")
                val out = it.outputStream
                try {
                    val data = assets.open(path).readBytes()
                    val mime = mimeType(path)
                    out.write("HTTP/1.1 200 OK\r\nContent-Type: $mime\r\nContent-Length: ${data.size}\r\nConnection: close\r\n\r\n".toByteArray())
                    out.write(data)
                } catch (_: Exception) {
                    out.write("HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".toByteArray())
                }
            }
        }.start()
    }

    private fun mimeType(path: String) = when {
        path.endsWith(".html") -> "text/html; charset=utf-8"
        path.endsWith(".js")   -> "application/javascript"
        path.endsWith(".css")  -> "text/css"
        path.endsWith(".svg")  -> "image/svg+xml"
        path.endsWith(".png")  -> "image/png"
        path.endsWith(".json") -> "application/json"
        else                   -> "application/octet-stream"
    }

    fun close() = serverSocket?.close()
}
