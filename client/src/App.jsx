import { ThemeProvider } from "./context/ThemeProvider";
import { AuthProvider } from "./context/AuthProvider";
import AppRoutes from "./routes/AppRoutes";

// Root shell. Holds only app-wide wrapping — the actual screens live in
// routes/AppRoutes.jsx and pages/.
//
// The theme toggle used to sit here, floating in the corner, because there was
// no layout to put it in. There is now: it lives in components/layout/AppLayout
// for signed-in screens, and on the login page itself, which sits outside that
// layout and would otherwise have no way to switch.
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
