import { ThemeProvider } from "./context/ThemeProvider";
import ThemeToggle from "./components/common/ThemeToggle";
import AppRoutes from "./routes/AppRoutes";

// Root shell. Holds only app-wide wrapping (nav, providers, etc.) as they get
// added later — the actual screens live in routes/AppRoutes.jsx and pages/.
//
// The toggle is parked here, fixed to the corner, because there is no layout
// component yet and criterion 1 asks for a control reachable from EVERY screen.
// Building a layout now would mean inventing navigation nobody has designed.
// When "Log in" builds the real shell, the toggle moves into it — one line.
function App() {
  return (
    <ThemeProvider>
      <ThemeToggle className="fixed top-4 right-4 z-50" />
      <AppRoutes />
    </ThemeProvider>
  );
}

export default App;
