import { createBrowserRouter } from "react-router";
import { HomePage } from "@/pages/HomePage";
import { NotFoundPage } from "@/pages/NotFoundPage";

// Halaman berat (Recharts, fixtures) dimuat saat dibuka agar bundle awal tetap kecil.
const demoPage = () => import("@/pages/DemoPage").then((m) => ({ Component: m.DemoPage }));

export const router = createBrowserRouter([
  { path: "/", element: <HomePage /> },
  { path: "/demo", lazy: demoPage },
  { path: "/demo/:section", lazy: demoPage },
  { path: "*", element: <NotFoundPage /> },
]);
