# Lists Viewer - Client (Frontend PWA)

A Progressive Web App (PWA) built with React, TypeScript, Vite, and Material-UI for managing lists and todos with offline-first support.

## Technology Stack

- **Language**: TypeScript 5.0+
- **Framework**: React 18.0+
- **Build Tool**: Vite 5.0+
- **UI Library**: Material-UI (MUI) 5.0+
- **State Management**: TanStack Query (React Query) 5.0+
- **Local Storage**: IndexedDB + sql.js
- **PWA**: Workbox with Vite PWA plugin
- **HTTP Client**: Axios

## Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── Layout/
│   │   ├── Lists/
│   │   ├── Items/
│   │   └── Common/
│   ├── hooks/
│   ├── services/
│   │   ├── api/
│   │   ├── storage/
│   │   └── offline/
│   ├── store/
│   ├── types/
│   ├── utils/
│   ├── pages/
│   ├── styles/
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── public/
│   ├── icons/
│   ├── manifest.json
│   └── favicon.ico
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18.0 or higher
- npm or pnpm

### Installation

1. **Navigate to client directory**:
   ```bash
   cd client
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

### Development

Start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

### Building for Production

```bash
npm run build
```

The production build will be in the `dist/` directory.

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## Features

- **Responsive Design**: Works on desktop, tablet, and mobile
- **Offline Support**: Full offline functionality with IndexedDB
- **Dark Theme**: Material-UI dark theme implementation
- **PWA**: Installable on iOS, Android, and desktop
- **Fast**: Optimized with Vite for fast development and production builds
- **Type-Safe**: Full TypeScript support

## API Integration

The client communicates with the backend API at:
- Development: `http://localhost:8080/api/v1`
- Production: Will be configured via environment variables

## Service Worker

The service worker is managed by Workbox and configured in `vite.config.ts`. It handles:
- Offline request caching
- Cache strategies
- Background sync for pending operations

## Environment Variables

Create a `.env` file in the client directory:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

## Contributing

See the main [CONTRIBUTING.md](../../CONTRIBUTING.md) file in the project root.

## License

MIT
