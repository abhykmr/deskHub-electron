# DeskHub

DeskHub is a minimal keyboard-driven desktop launcher built with Electron.

It allows you to quickly launch desktop apps and web apps using a searchable grid interface.

## Features

- Windows app detection
- Start Menu scanning
- Registry app detection
- UWP app support
- Progressive loading
- System tray integration
- Global shortcut (Ctrl + Space)
- Keyboard navigation
- Web app support

## Tech Stack

- Electron
- HTML
- CSS
- JavaScript

## Project Structure

src/
main/ # Electron main process
preload/ # Secure bridge between UI and system
renderer/ # UI layer

data/
apps.json # Stores installed apps

assets/
icons and images

## Run the project

npm install
npm start

## Preview

![DeskHub UI](docs/deskhub-preview-4.png)
![DeskHub UI](docs/deskhub-preview-3.png)

## Future Features

- Fuzzy search
- Pinned apps
- Plugin system
- Cross platform support
