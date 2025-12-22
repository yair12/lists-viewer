import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'
import { useState } from 'react'
import './App.css'

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
    background: {
      default: '#121212',
      paper: '#1e1e1e',
    },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
  },
})

function App() {
  const [count, setCount] = useState(0)

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <div className="app">
        <h1>Lists Viewer</h1>
        <p>A Progressive Web App for managing your lists</p>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          This is a placeholder. The application is under development.
        </p>
      </div>
    </ThemeProvider>
  )
}

export default App
