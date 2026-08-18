import { Routes, Route } from "react-router-dom";
import StatusPage from "../pages/StatusPage";
import LoginPage from "../pages/LoginPage";

// The single list of URL -> page mappings. Add new routes here only.
function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<StatusPage />} />
      <Route path="/login" element={<LoginPage />} />
    </Routes>
  );
}

export default AppRoutes;
