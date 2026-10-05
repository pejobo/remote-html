package com.remote.tv

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.util.Patterns
import android.widget.Toast

// Invisible share target: forwards the shared URL to the app without bringing it to the front.
class ShareActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val text = intent.getStringExtra(Intent.EXTRA_TEXT).orEmpty()
        val url = Patterns.WEB_URL.toRegex().find(text)?.value
            ?.takeIf { it.startsWith("http://", true) || it.startsWith("https://", true) }
        val main = MainActivity.instance
        when {
            url == null -> Toast.makeText(this, "No valid URL", Toast.LENGTH_SHORT).show()
            main != null -> main.playUrl(url)
            else -> startActivity(
                Intent(this, MainActivity::class.java)
                    .putExtra(MainActivity.EXTRA_PLAY_URL, url)
                    .putExtra(MainActivity.EXTRA_BACKGROUND, true)
            )
        }
        finish()
    }
}
