# BillFlow brand identity

The current BillFlow logo was designed by **Lahiru**. The unmodified V1 exports are kept in `source/`; use these instead of introducing another logo or recreating the artwork.

- **Colored Icon:** sidebar branding in light mode.
- **White Icon:** sidebar branding in dark mode, adaptive macOS menu-bar template, and Windows tray on a dark taskbar.
- **App Shape:** macOS Dock/Finder, Windows application/installer/shortcuts, browser favicon, and home-screen icons.
- **Full Image:** original presentation artwork, available for future uses.

Generated assets trim only fully transparent outer padding, preserve aspect ratio and colors, and add transparent spacing appropriate to the destination. Both sidebar variants use the same square canvas so theme changes do not move the wordmark.

Run `npm run brand:generate` after replacing the source exports. The script uses Sharp supplied by the installed Next.js dependencies and creates the public PNG assets, Next.js metadata icons, and `build/icon.png`, `build/icon.ico`, and `build/icon.icns`. Generated assets are committed so ordinary builds require no extra generation step.

Electron uses the PNG at runtime, including development Dock branding. Electron Builder uses the platform-specific icon files for packaged apps and Windows installers. Rebuild/reinstall an existing desktop installation to update its Finder/Explorer shortcuts; changing source assets does not replace an already installed binary.

Tray assets are generated under `build/tray`. macOS adapts the template to its menu-bar appearance and includes a Retina representation. Windows uses the white mark on dark taskbars and the colored mark on light taskbars. The tray offers Open BillFlow and Quit BillFlow; closing the window retains the existing platform behavior.
