import AppRoutes from "./routes/AppRoutes";

// Root shell. Holds only app-wide wrapping (nav, providers, etc.) as they get
// added later — the actual screens live in routes/AppRoutes.jsx and pages/.
function App() {
  return <AppRoutes />;
}

export default App;
