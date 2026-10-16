package com.remote.tv

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.Toast
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONObject
import java.net.URLEncoder
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

// Invisible share target: sends the shared URL straight to Kodi, the app itself is never shown.
class ShareActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
        val url = Regex("https?://[^\\s<>\"']+", RegexOption.IGNORE_CASE).find(text)?.value
            ?.trimEnd('.', ',', ';', ')', ']', '!', '?')
        if (url == null) {
            toast("No valid URL")
            finish()
            return
        }
        Thread {
            val message = try {
                val kodiUrl = JSONObject(assets.open("config.json").bufferedReader().use { it.readText() })
                    .getString("kodi_url")
                if (kodiUrl.contains("\${hostname}")) "Kodi URL not configured"
                else if (playUrl(kodiUrl, url)) null else "Kodi request failed"
            } catch (_: Exception) {
                "Kodi request failed"
            }
            runOnUiThread {
                message?.let { toast(it) }
                finish()
            }
        }.start()
    }

    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_SHORT).show()

    private fun playUrl(kodiUrl: String, url: String): Boolean {
        val request = JSONObject()
            .put("jsonrpc", "2.0")
            .put("id", 1)
            .put("method", "Addons.ExecuteAddon")
            .put("params", JSONObject()
                .put("addonid", "script.scripter")
                .put("params", "action=play_url&url=" + URLEncoder.encode(url, "UTF-8")))
            .toString()
        val done = CountDownLatch(1)
        var success = false
        val client = OkHttpClient.Builder()
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build()
        val socket = client.newWebSocket(Request.Builder().url(kodiUrl).build(), object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                webSocket.send(request)
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                val m = try { JSONObject(text) } catch (_: Exception) { return }
                if (m.optInt("id", -1) == 1) { // ignore kodi notifications
                    success = !m.has("error")
                    done.countDown()
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                done.countDown()
            }
        })
        done.await(5, TimeUnit.SECONDS)
        socket.close(1000, null)
        client.dispatcher.executorService.shutdown()
        return success
    }
}
