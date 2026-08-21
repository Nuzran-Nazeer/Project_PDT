import { useContext } from "react";
import { AuthContext } from "../context/authContext";

// The signed-in user, their token, and the two actions that change either.
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside an AuthProvider");
  }
  return context;
}
