import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from './components/Layout'
import Overview from './pages/Overview'
import Area from './pages/Area'
import { BG, TEXT } from './theme'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: 1,
    },
  },
})

// Global body styles
const globalCSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body, #root {
    height: 100%;
    background: ${BG};
    color: ${TEXT};
    font-family: 'DM Sans', sans-serif;
  }
  h1, h2, h3, h4, h5, h6 { font-family: 'DM Serif Display', serif; }
  a { color: inherit; text-decoration: none; }
`

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <style>{globalCSS}</style>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/area/:code" element={<Area />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
