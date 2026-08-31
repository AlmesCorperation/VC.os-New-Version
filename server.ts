import express from "express";
import { createServer as createViteServer } from "vite";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import libarchive from "libarchive/node";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const server = createServer(app);
  const PORT = 3000;

  // WebSocket Server for Multiplayer Sync
  const wss = new WebSocketServer({ server });

  // Room state: gameId -> { players: Set<WebSocket>, state: any }
  const rooms = new Map<string, { players: Set<WebSocket>, state: any }>();

  wss.on("connection", (ws) => {
    let currentRoom: string | null = null;

    ws.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());

        switch (message.type) {
          case "join": {
            const { gameId } = message;
            currentRoom = gameId;
            if (!rooms.has(gameId)) {
              rooms.set(gameId, { players: new Set(), state: {} });
            }
            rooms.get(gameId)!.players.add(ws);
            
            // Send current state to the new player
            ws.send(JSON.stringify({ 
              type: "sync", 
              state: rooms.get(gameId)!.state 
            }));
            break;
          }
          case "update": {
            if (currentRoom && rooms.has(currentRoom)) {
              const room = rooms.get(currentRoom)!;
              // Merge state
              room.state = { ...room.state, ...message.state };
              
              // Broadcast to others in the room
              const broadcastData = JSON.stringify({ 
                type: "sync", 
                state: room.state,
                sender: message.sender // Optional: to avoid self-update loop
              });
              
              room.players.forEach((player) => {
                if (player !== ws && player.readyState === WebSocket.OPEN) {
                  player.send(broadcastData);
                }
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error("WS Error:", err);
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms.has(currentRoom)) {
        const room = rooms.get(currentRoom)!;
        room.players.delete(ws);
        if (room.players.size === 0) {
          rooms.delete(currentRoom);
        }
      }
    });
  });

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", rooms: rooms.size });
  });

  app.use(express.json({ limit: '50mb' }));

  app.post("/api/compile-iso", async (req, res) => {
    const { filename, files } = req.body;
    if (!files || typeof files !== 'object') {
      return res.status(400).send("Files object is required");
    }

    const tempDir = path.join(os.tmpdir(), `vcos-iso-${Date.now()}`);
    const isoPath = path.join(os.tmpdir(), filename || 'vcos_disk.iso');

    try {
      fs.mkdirSync(tempDir, { recursive: true });
      
      // Write files to temp directory
      const filePaths: string[] = [];
      for (const [name, content] of Object.entries(files)) {
        const fullPath = path.join(tempDir, name as string);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, content as string);
        filePaths.push(name as string);
      }

      // Use mkisofs to create ISO if available, otherwise fallback to libarchive
      const originalCwd = process.cwd();
      process.chdir(tempDir);
      
      try {
        let hasMkisofs = false;
        try {
          execSync('mkisofs --version');
          hasMkisofs = true;
        } catch (e) {}

        if (hasMkisofs) {
          // mkisofs -o <output> -R -J <source_dir>
          // Since we are in tempDir, we use '.' as source
          execSync(`mkisofs -o "${isoPath}" -R -J .`);
        } else {
          await libarchive.compress(filePaths, isoPath);
        }
      } finally {
        process.chdir(originalCwd);
      }

      const isoBuffer = fs.readFileSync(isoPath);
      
      res.setHeader("Content-Type", "application/x-cd-image");
      res.setHeader("Content-Disposition", `attachment; filename="${filename || 'vcos_disk.iso'}"`);
      res.send(isoBuffer);

    } catch (error: any) {
      console.error("ISO Compilation Error:", error);
      res.status(500).send("ISO Compilation Error: " + error.message);
    } finally {
      // Cleanup
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (fs.existsSync(isoPath)) fs.unlinkSync(isoPath);
      } catch (e) {
        console.error("Cleanup error:", e);
      }
    }
  });

  app.get("/api/proxy", async (req, res) => {
    const url = req.query.url as string;
    if (!url) return res.status(400).send("URL is required");

    try {
      const response = await fetch(url);
      const contentType = response.headers.get("content-type");
      let body = await response.text();

      // Inject <base> tag to handle relative links
      if (contentType?.includes("text/html")) {
        const baseTag = `<base href="${url}">`;
        if (body.includes("<head>")) {
          body = body.replace("<head>", `<head>\n${baseTag}`);
        } else if (body.includes("<html>")) {
          body = body.replace("<html>", `<html><head>${baseTag}</head>`);
        } else {
          body = baseTag + "\n" + body;
        }
      }

      res.setHeader("Content-Type", contentType || "text/html");
      // Strip security headers that prevent iframe embedding
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Content-Security-Policy");
      res.send(body);
    } catch (error) {
      // Fallback to Gemini to generate a fake website if the fetch fails
      try {
             if (process.env.GEMINI_API_KEY) {
                const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
                const response = await ai.models.generateContent({
                  model: 'gemini-3.1-flash',
                  contents: `You are simulating a proxy server pulling content from the World Wide Web.
The user tried to visit the URL: "${url}" but it timed out or was unreachable.
Generate a cohesive HTML webpage representing what this URL might have looked like.
Make it look like a classic 90s/2000s webpage, or a modern one depending on the domain.
Use inline styles or a <style> block, don't use external CSS. Include a fun fake UI.
Return ONLY valid HTML.`
                });
                let html = response.text || "<html><body>Error Generating Webpage</body></html>";
                html = html.replace(/```html|```/gi, '').trim();
                res.setHeader("Content-Type", "text/html");
                res.send(html);
             } else {
                res.status(500).send("Proxy error: " + error);
             }
      } catch (geminiErr) {
          res.status(500).send("Proxy error: " + error);
      }
    }
  });

  app.get("/api/search", async (req, res) => {
    const query = req.query.q;
    const apiKey = process.env.SERPER_API_KEY;

    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    if (apiKey) {
      try {
        const response = await fetch("https://google.serper.dev/search", {
          method: "POST",
          headers: {
            "X-API-KEY": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ q: query }),
        });
        const data = await response.json();
        
        const results = (data.organic || []).map((item: any) => ({
          title: item.title,
          link: item.link,
          snippet: item.snippet
        }));

        return res.json({ items: results });
      } catch (error) {
        console.error("Serper API Error:", error);
      }
    }

    // Fallback to Gemini AI if Serper API fails or is not configured
    try {
      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: "No search keys configured (SERPER_API_KEY or GEMINI_API_KEY)" });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash',
        contents: `You are simulating a web search engine API. 
The user searched for: "${query}"

Generate 5-10 realistic search results for this query. Return ONLY a valid JSON object with the following schema:
{
  "items": [
    {
      "title": "Page Title",
      "link": "https://example.com/page",
      "snippet": "A short realistic snippet describing the page content."
    }
  ]
}`,
        config: {
          responseMimeType: "application/json",
        }
      });

      const text = response.text;
      const data = JSON.parse(text || "{}");
      res.json({ items: data.items || [] });
    } catch (error) {
      console.error("Gemini Search Generation Error:", error);
      res.status(500).json({ error: "Failed to fetch search results" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static serving would go here
    app.use(express.static("build"));
    app.get('*', (req, res) => {
      res.sendFile(path.join(process.cwd(), 'build', 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
    try {
      const version = execSync('mkisofs --version').toString();
      console.log('mkisofs available:', version.split('\n')[0]);
    } catch (e) {
      console.log('mkisofs not found, falling back to libarchive');
    }
  });
}

startServer();
