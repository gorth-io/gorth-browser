import { Menu, type MenuItemConstructorOptions } from "electron";
import { APP_NAME, createWindow } from "@/main/windows/capital";
import { sendAppAction } from "@/main/ipc/native-menu";
import { resizeFocusedWindow } from "@/main/ipc/window";
import { applyShortcutAccelerators } from "@/main/ipc/shortcuts";

export function installApplicationMenu() {
  const fileMenu: MenuItemConstructorOptions = {
    label: "File",
    submenu: [
      {
        label: "New Tab",
        accelerator: "CmdOrCtrl+T",
        click: () => sendAppAction("new-tab"),
      },
      {
        label: "New Window",
        accelerator: "CmdOrCtrl+N",
        click: () => createWindow(),
      },
      { type: "separator" },
      {
        label: "Close Window",
        accelerator: "CmdOrCtrl+Shift+W",
        role: "close",
      },
    ],
  };
  const template: MenuItemConstructorOptions[] = [
    ...(process.platform === "darwin"
      ? [
          {
            label: APP_NAME,
            submenu: [
              {
                label: `About ${APP_NAME}`,
                click: () => sendAppAction("settings/help"),
              },
              { type: "separator" as const },
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: () => sendAppAction("settings"),
              },
              { type: "separator" as const },
              { role: "services" as const },
              { type: "separator" as const },
              { role: "hide" as const },
              { role: "hideOthers" as const },
              { role: "unhide" as const },
              { type: "separator" as const },
              { role: "quit" as const },
            ],
          },
        ]
      : []),
    fileMenu,
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Find in Page",
          accelerator: "CmdOrCtrl+F",
          click: () => sendAppAction("find-in-page"),
        },
        { type: "separator" },
        {
          label: "Reload",
          accelerator: "CmdOrCtrl+R",
          click: () => sendAppAction("reload-tab"),
        },
        {
          label: "Force Reload",
          accelerator: "CmdOrCtrl+Shift+R",
          click: () => sendAppAction("force-reload-tab"),
        },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Tabs",
      submenu: [
        ...(process.platform !== "darwin"
          ? [
              {
                label: "Settings…",
                accelerator: "CmdOrCtrl+,",
                click: () => sendAppAction("settings"),
              },
            ]
          : []),
        {
          label: "Keyboard Shortcuts",
          accelerator: "CmdOrCtrl+Shift+K",
          click: () => sendAppAction("shortcuts"),
        },
        {
          label: "Next Tab",
          accelerator: "Ctrl+Tab",
          click: () => sendAppAction("next-tab"),
        },
        {
          label: "Previous Tab",
          accelerator: "Ctrl+Shift+Tab",
          click: () => sendAppAction("previous-tab"),
        },
        {
          label: "Reopen Closed Tab",
          accelerator: "CmdOrCtrl+Shift+T",
          click: () => sendAppAction("reopen-closed-tab"),
        },
        { type: "separator" },
        {
          label: "Close Tab",
          accelerator: "CmdOrCtrl+W",
          click: () => sendAppAction("close-tab"),
        },
      ],
    },
    {
      label: "Spaces",
      submenu: [
        {
          label: "Default Space",
          type: "checkbox",
          checked: true,
          enabled: false,
        },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        { type: "separator" },
        {
          label: "HD (1280 × 720)",
          click: () => resizeFocusedWindow(1280, 720),
        },
        {
          label: "FHD (1920 × 1080)",
          click: () => resizeFocusedWindow(1920, 1080),
        },
        ...(process.platform === "darwin"
          ? [{ type: "separator" as const }, { role: "front" as const }]
          : []),
      ],
    },
  ];
  applyShortcutAccelerators(template);
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
