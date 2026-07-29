const { createProxyMiddleware } = require("http-proxy-middleware");
const https = require("https");

module.exports = function (app) {
  // ── External review-service proxies (dev) ───────────────────────────────────
  // Let the AI/Review modal work against the CRA dev server (the extension and
  // the Android app fetch these hosts directly). These must be registered
  // BEFORE the catch-all KGS proxy below, which otherwise forwards every
  // /api/* path to gokgs.com.

  // Fetch a KGS .sgf and return its text. Only files.gokgs.com is allowed.
  app.get("/api/sgf", function (req, res) {
    const url = req.query.url;
    if (
      typeof url !== "string" ||
      url.indexOf("https://files.gokgs.com/") !== 0
    ) {
      res.status(400).json({ error: "Invalid SGF url" });
      return;
    }
    https
      .get(url, function (upstream) {
        if (upstream.statusCode !== 200) {
          upstream.resume();
          res.status(502).json({ error: "SGF fetch failed" });
          return;
        }
        res.setHeader("Content-Type", "application/x-go-sgf");
        upstream.pipe(res);
      })
      .on("error", function () {
        res.status(502).json({ error: "SGF fetch failed" });
      });
  });

  // Forward an import POST to Kifubara and relay its JSON response. Body is read
  // raw (no body-parser is registered in the dev server).
  app.post("/api/kifubara/import", function (req, res) {
    const chunks = [];
    req.on("data", function (c) {
      chunks.push(c);
    });
    req.on("error", function (err) {
      console.error("[kifubara proxy] request error:", err);
      if (!res.headersSent) {
        res.status(502).json({ error: "Kifubara import failed (req)" });
      }
    });
    req.on("end", function () {
      try {
        const postData = Buffer.concat(chunks);
        const upstream = https.request(
          {
            hostname: "kifubara.app",
            port: 443,
            path: "/api/import",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Content-Length": Buffer.byteLength(postData),
            },
          },
          function (r) {
            const bodyChunks = [];
            r.on("data", function (chunk) {
              bodyChunks.push(chunk);
            });
            r.on("end", function () {
              if (res.headersSent) {
                return;
              }
              res.status(r.statusCode || 502);
              res.setHeader(
                "Content-Type",
                r.headers["content-type"] || "application/json"
              );
              res.send(Buffer.concat(bodyChunks));
            });
          }
        );
        upstream.on("error", function (err) {
          console.error("[kifubara proxy] upstream error:", err);
          if (!res.headersSent) {
            res.status(502).json({ error: "Kifubara import failed" });
          }
        });
        upstream.write(postData);
        upstream.end();
      } catch (err) {
        console.error("[kifubara proxy] handler crash:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Kifubara proxy crash" });
        }
      }
    });
  });

  var setKgsHeaders = function (proxyReq) {
    proxyReq.setHeader("origin", "https://www.gokgs.com");
    proxyReq.setHeader("referer", "https://www.gokgs.com/");
  };

  // Surface upstream failures in the npm-start terminal with their error code
  // (ECONNRESET, ETIMEDOUT, socket hang up...) — a bare 502 in the browser is
  // undebuggable.
  var logKgsError = function (err, req, res) {
    console.error(
      "[KGS proxy] " + req.method + " " + req.url + " failed:",
      err.code || err.message
    );
    if (res && !res.headersSent && res.writeHead) {
      res.writeHead(502, { "Content-Type": "application/json" });
    }
    if (res && res.end) {
      res.end(JSON.stringify({ error: "KGS upstream error" }));
    }
  };

  // The client defaults to /api/json-cors/access in dev (see KgsClient.js),
  // but gokgs.com only serves /json-cors/access — that /api path exists only
  // as a Vercel serverless function. Strip the prefix on the way out and put
  // it back on the session cookie path so the browser keeps sending the
  // cookie to /api/json-cors/access. Scoped to /api only: direct /json-cors
  // requests (e.g. REACT_APP_API_URL=/json-cors/access) must keep the
  // original cookie path or their session dies after login.
  app.use(
    "/api",
    createProxyMiddleware({
      target: "https://www.gokgs.com",
      changeOrigin: true,
      secure: false,
      pathRewrite: { "^/api/json-cors": "/json-cors" },
      cookiePathRewrite: { "/json-cors": "/api/json-cors" },
      onProxyReq: setKgsHeaders,
      onError: logKgsError,
    })
  );

  app.use(
    ["/json", "/json-cors"],
    createProxyMiddleware({
      target: "https://www.gokgs.com",
      changeOrigin: true,
      secure: false,
      onProxyReq: setKgsHeaders,
      onError: logKgsError,
    })
  );
};
