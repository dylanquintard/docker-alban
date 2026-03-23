import { lazy, Suspense, useContext, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthContext, AuthProvider } from "@shared/context/AuthContext";
import { LanguageProvider, useLanguage } from "@shared/context/LanguageContext";
import { SiteSettingsProvider } from "@shared/context/SiteSettingsContext";
import { ThemeProvider } from "@shared/context/ThemeContext";
import AdminShell from "./components/AdminShell";
import AdminHome from "./pages/AdminHome";
import AdminLogin from "./pages/AdminLogin";

const BlogAdmin = lazy(() => import("@shared/pages/BlogAdmin"));
const EditProduct = lazy(() => import("@shared/pages/EditProduct"));
const FaqAdmin = lazy(() => import("@shared/pages/FaqAdmin"));
const GalleryTabsAdmin = lazy(() => import("@shared/pages/GalleryTabsAdmin"));
const Ingredients = lazy(() => import("@shared/pages/Ingredients"));
const PrintAdmin = lazy(() => import("@shared/pages/PrintAdmin"));
const Products = lazy(() => import("@shared/pages/Products"));
const SiteInfoAdmin = lazy(() => import("@shared/pages/SiteInfoAdmin"));
const TimeslotsAdmin = lazy(() => import("@shared/pages/Timeslots"));

function LoadingScreen() {
  const { tr } = useLanguage();
  return (
    <div className="flex min-h-[240px] items-center justify-center text-sm text-stone-300">
      {tr("Chargement...", "Loading...")}
    </div>
  );
}

function RequireAdmin({ children }) {
  const { token, user, loading, forceSessionHydration } = useContext(AuthContext);
  const location = useLocation();

  useEffect(() => {
    void forceSessionHydration?.();
  }, [forceSessionHydration]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!token || user?.role !== "ADMIN") {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    );
  }

  return <AdminShell>{children}</AdminShell>;
}

function AdminRoutes() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/admin/login" element={<Navigate to="/login" replace />} />

        <Route
          path="/"
          element={
            <RequireAdmin>
              <AdminHome />
            </RequireAdmin>
          }
        />
        <Route path="/admin" element={<Navigate to="/" replace />} />

        <Route
          path="/menu"
          element={
            <RequireAdmin>
              <Products />
            </RequireAdmin>
          }
        />
        <Route path="/admin/menu" element={<Navigate to="/menu" replace />} />

        <Route
          path="/ingredients"
          element={
            <RequireAdmin>
              <Ingredients />
            </RequireAdmin>
          }
        />
        <Route path="/admin/ingredients" element={<Navigate to="/ingredients" replace />} />

        <Route
          path="/timeslots"
          element={
            <RequireAdmin>
              <TimeslotsAdmin />
            </RequireAdmin>
          }
        />
        <Route path="/admin/timeslots" element={<Navigate to="/timeslots" replace />} />
        <Route path="/admin/locations" element={<Navigate to="/timeslots#emplacements" replace />} />

        <Route
          path="/gallery"
          element={
            <RequireAdmin>
              <GalleryTabsAdmin />
            </RequireAdmin>
          }
        />
        <Route path="/admin/gallery" element={<Navigate to="/gallery" replace />} />
        <Route path="/admin/gallery-hero" element={<Navigate to="/gallery?tab=hero" replace />} />
        <Route path="/admin/gallery-menu" element={<Navigate to="/gallery?tab=menu" replace />} />

        <Route
          path="/print"
          element={
            <RequireAdmin>
              <PrintAdmin />
            </RequireAdmin>
          }
        />
        <Route path="/admin/print" element={<Navigate to="/print" replace />} />

        <Route
          path="/blog"
          element={
            <RequireAdmin>
              <BlogAdmin />
            </RequireAdmin>
          }
        />
        <Route path="/admin/blog" element={<Navigate to="/blog" replace />} />

        <Route
          path="/faq"
          element={
            <RequireAdmin>
              <FaqAdmin />
            </RequireAdmin>
          }
        />
        <Route path="/admin/faq" element={<Navigate to="/faq" replace />} />

        <Route
          path="/site-info"
          element={
            <RequireAdmin>
              <SiteInfoAdmin />
            </RequireAdmin>
          }
        />
        <Route path="/admin/site-info" element={<Navigate to="/site-info" replace />} />

        <Route
          path="/editproduct/:id"
          element={
            <RequireAdmin>
              <EditProduct />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/editproduct/:id"
          element={
            <RequireAdmin>
              <EditProduct />
            </RequireAdmin>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ThemeProvider>
        <LanguageProvider>
          <SiteSettingsProvider>
            <BrowserRouter>
              <AdminRoutes />
            </BrowserRouter>
          </SiteSettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
