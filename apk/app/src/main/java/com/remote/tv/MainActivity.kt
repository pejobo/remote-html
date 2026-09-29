package com.remote.tv

import android.content.res.AssetManager
import android.os.Bundle
import android.view.KeyEvent
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import java.io.BufferedReader
import java.io.InputStreamReader
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var server: LocalAssetServer

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
        webView.webViewClient = WebViewClient()
        webView.webChromeClient = WebChromeClient()

        server = LocalAssetServer(assets) { port ->
            runOnUiThread { webView.loadUrl("http://localhost:$port/index.html") }
        }
        server.isDaemon = true
        server.start()
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
