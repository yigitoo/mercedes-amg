/**
 * AMG Pulse masaüstü uygulaması.
 *
 * Web uygulamasını (yerel ya da Vercel) bir pencerede açar; kod kopyalamaz, tek doğruluk kaynağı web'dir.
 *   AMG_URL=https://... pnpm start      hedef adres (varsayılan http://localhost:3000)
 *   pnpm kiosk                           TV için tam ekran kiosk modu (çıkış: Cmd/Ctrl+Q)
 *
 * Sunucuya ulaşılamazsa markalı bekleme ekranı gösterir ve 5 sn'de bir yeniden dener: TV başında kimse yokken de toparlanır.
 */
const { app, BrowserWindow, Menu, shell } = require("electron");
const path = require("node:path");

const BASE_URL = (process.env.AMG_URL || "http://localhost:3000").replace(/\/+$/, "");

// Lansman açılışındaki motor sesi, kimse ekrana dokunmadan da çalsın (TV/kiosk).
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
const KIOSK = process.argv.includes("--kiosk");
const RETRY_MS = 5000;

/** @type {BrowserWindow | null} */
let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1920,
    height: 1080,
    backgroundColor: "#0a0a0b",
    title: "AMG Pulse",
    icon: path.join(__dirname, "icon.png"),
    kiosk: KIOSK,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true },
  });

  win.webContents.on("did-fail-load", (_event, code, _description, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3: kullanıcı iptal etti
    win?.loadFile(path.join(__dirname, "offline.html"), { query: { target: url || BASE_URL, retry: String(RETRY_MS) } });
  });

  // Uygulama dışı bağlantılar varsayılan tarayıcıda açılsın.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith(BASE_URL)) {
      win?.loadURL(url);
    } else {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  win.loadURL(BASE_URL);
}

function buildMenu() {
  const go = (p) => () => win?.loadURL(BASE_URL + p);
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: "appMenu" },
      {
        label: "Görünüm",
        submenu: [
          { label: "Canlı ekran", accelerator: "CmdOrCtrl+1", click: go("/") },
          { label: "Admin paneli", accelerator: "CmdOrCtrl+2", click: go("/admin") },
          { type: "separator" },
          { role: "reload", label: "Yenile" },
          { role: "togglefullscreen", label: "Tam ekran" },
          { role: "toggleDevTools", label: "Geliştirici araçları" },
        ],
      },
    ]),
  );
}

app.whenReady().then(() => {
  // macOS geliştirme modunda Dock'ta da Mercedes yıldızı görünsün (paketli uygulamada build ikonu kullanılır).
  if (process.platform === "darwin") app.dock?.setIcon(path.join(__dirname, "icon.png"));
  buildMenu();
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
