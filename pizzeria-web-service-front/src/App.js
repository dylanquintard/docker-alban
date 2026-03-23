import { Suspense, useContext, useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigationType,
  useParams,
} from "react-router-dom";
import Header from "./components/layout/Header";
import MobileStickyCta from "./components/layout/MobileStickyCta";
import SiteFooter from "./components/layout/SiteFooter";
import MainContent from "./components/layout/MainContent";
import { AuthContext, AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { LanguageProvider, useLanguage } from "./context/LanguageContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";
import { ThemeProvider } from "./context/ThemeContext";
import Home from "./pages/Home";
import { lazyWithSingleReload } from "./utils/lazyWithSingleReload";
import { slugifyCity } from "./utils/slugifyCity";
const Dashboard = lazyWithSingleReload(() => import("./pages/Dashboard"), "route-dashboard");
const EditProduct = lazyWithSingleReload(() => import("./pages/EditProduct"), "route-edit-product");
const GalleryTabsAdmin = lazyWithSingleReload(
  () => import("./pages/GalleryTabsAdmin"),
  "route-gallery-tabs-admin"
);
const ForgotPassword = lazyWithSingleReload(
  () => import("./pages/ForgotPassword"),
  "route-forgot-password"
);
const Menu = lazyWithSingleReload(() => import("./pages/Menu"), "route-menu");
const TourneeCamion = lazyWithSingleReload(() => import("./pages/planing"), "route-planing");
const APropos = lazyWithSingleReload(() => import("./pages/APropos"), "route-a-propos");
const ContactPage = lazyWithSingleReload(() => import("./pages/ContactPage"), "route-contact");
const LocalSeoPage = lazyWithSingleReload(() => import("./pages/LocalSeoPage"), "route-local-seo");
const CitySeoPage = lazyWithSingleReload(() => import("./pages/CitySeoPage"), "route-city-seo");
const PizzaPage = lazyWithSingleReload(() => import("./pages/PizzaPage"), "route-pizza");
const Blog = lazyWithSingleReload(() => import("./pages/Blog"), "route-blog");
const BlogArticle = lazyWithSingleReload(() => import("./pages/BlogArticle"), "route-blog-article");
const BlogAdmin = lazyWithSingleReload(() => import("./pages/BlogAdmin"), "route-blog-admin");
const FaqAdmin = lazyWithSingleReload(() => import("./pages/FaqAdmin"), "route-faq-admin");
const SiteInfoAdmin = lazyWithSingleReload(
  () => import("./pages/SiteInfoAdmin"),
  "route-site-info-admin"
);
const NotFound = lazyWithSingleReload(() => import("./pages/NotFound"), "route-not-found");
const Ingredients = lazyWithSingleReload(() => import("./pages/Ingredients"), "route-ingredients");
const Login = lazyWithSingleReload(() => import("./pages/Login"), "route-login");
const LegalMentions = lazyWithSingleReload(
  () => import("./pages/LegalMentions"),
  "route-mentions-legales"
);
const Order = lazyWithSingleReload(() => import("./pages/Order"), "route-order");
const OrderConfirmation = lazyWithSingleReload(
  () => import("./pages/OrderConfirmation"),
  "route-order-confirmation"
);
const OrderList = lazyWithSingleReload(() => import("./pages/OrderList"), "route-order-list");
const PrivacyPolicy = lazyWithSingleReload(
  () => import("./pages/PrivacyPolicy"),
  "route-confidentialite"
);
const Products = lazyWithSingleReload(() => import("./pages/Products"), "route-products");
const Profile = lazyWithSingleReload(() => import("./pages/Profile"), "route-profile");
const Register = lazyWithSingleReload(() => import("./pages/Register"), "route-register");
const ResetPassword = lazyWithSingleReload(
  () => import("./pages/ResetPassword"),
  "route-reset-password"
);
const TermsPage = lazyWithSingleReload(() => import("./pages/TermsPage"), "route-terms");
const TimeslotsAdmin = lazyWithSingleReload(() => import("./pages/Timeslots"), "route-timeslots");
const PrintAdmin = lazyWithSingleReload(() => import("./pages/PrintAdmin"), "route-print-admin");
const TicketsAdmin = lazyWithSingleReload(
  () => import("./pages/TicketsAdmin"),
  "route-tickets-admin"
);
const Users = lazyWithSingleReload(() => import("./pages/Users"), "route-users");
const UserOrders = lazyWithSingleReload(() => import("./pages/UsersOrders"), "route-user-orders");
const VerifyEmail = lazyWithSingleReload(() => import("./pages/VerifyEmail"), "route-verify-email");

const APP_STYLE_ROUTE_PREFIXES = ["/admin", "/order"];
const APP_STYLE_EXACT_ROUTES = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/register",
  "/verify-email",
  "/profile",
  "/userorders",
];

let appStyleImportPromise = null;

function routeNeedsAppStyles(pathname) {
  const normalizedPath = String(pathname || "").toLowerCase();
  if (!normalizedPath) return false;

  if (APP_STYLE_ROUTE_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
    return true;
  }

  return APP_STYLE_EXACT_ROUTES.includes(normalizedPath);
}

function ensureAppStylesLoaded() {
  if (!appStyleImportPromise) {
    appStyleImportPromise = import("./styles/tailwind-app.css");
  }
  return appStyleImportPromise;
}

if (typeof window !== "undefined" && routeNeedsAppStyles(window.location.pathname)) {
  ensureAppStylesLoaded();
}

const PrivateRoute = ({ children }) => {
  const { token, loading, forceSessionHydration } = useContext(AuthContext);
  const { tr } = useLanguage();

  useEffect(() => {
    if (!loading) return;
    void forceSessionHydration?.();
  }, [forceSessionHydration, loading]);

  if (loading) return <p>{tr("Chargement...", "Loading...")}</p>;
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

const AdminRoute = ({ children }) => {
  const { token, user, loading } = useContext(AuthContext);
  const { tr } = useLanguage();

  if (loading) return <p>{tr("Chargement...", "Loading...")}</p>;
  if (!token || user?.role !== "ADMIN") return <Navigate to="/login" replace />;
  return children;
};

const AppLayout = () => {
  const location = useLocation();
  const navigationType = useNavigationType();
  const isAdminRoute = location.pathname.startsWith("/admin");

  useEffect(() => {
    if (!routeNeedsAppStyles(location.pathname)) return;
    ensureAppStylesLoaded();
  }, [location.pathname]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (location.hash) return;
      if (navigationType === "POP") return;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }
  }, [location.pathname, location.search, location.hash, navigationType]);

  return (
    <>
      <Header />
      <MainContent>
        <Outlet />
      </MainContent>
      {!isAdminRoute ? <SiteFooter /> : null}
      {!isAdminRoute ? <MobileStickyCta /> : null}
    </>
  );
};

const LegacyPizzaCityRoute = () => {
  const { city } = useParams();
  const slug = slugifyCity(city);
  if (!slug) {
    return <NotFound />;
  }
  return <Navigate to={`/pizza-${slug}`} replace />;
};

const LegacyBlogArticleRoute = () => {
  const { slug } = useParams();
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  if (!normalizedSlug) {
    return <Navigate to="/blog" replace />;
  }
  return <Navigate to={`/${normalizedSlug}`} replace />;
};

const CatchAllRoute = () => {
  const location = useLocation();
  const pathname = String(location.pathname || "").toLowerCase();
  const pizzaMatch = /^\/pizza-([a-z0-9-]+)$/.exec(pathname);
  if (pizzaMatch) {
    return <CitySeoPage forcedCitySlug={pizzaMatch[1]} />;
  }

  const blogMatch = /^\/([a-z0-9-]+)$/.exec(pathname);
  if (blogMatch) {
    return <BlogArticle forcedSlug={blogMatch[1]} />;
  }

  return <NotFound />;
};

function AppRoutes() {
  const { tr } = useLanguage();
  const loadingFallback = (
    <p className="section-shell py-8 text-sm text-stone-400">
      {tr("Chargement...", "Loading...")}
    </p>
  );

  return (
    <Suspense fallback={loadingFallback}>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/gallery" element={<Navigate to="/pizza#galerie-pizzas" replace />} />
          <Route path="/menu" element={<Menu />} />
          <Route path="/planing" element={<TourneeCamion />} />
          <Route path="/tournée-camion" element={<Navigate to="/planing" replace />} />
          <Route path="/tournée" element={<Navigate to="/planing" replace />} />
          <Route path="/a-propos" element={<APropos />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/blog" element={<Blog />} />
          <Route path="/mentions-legales" element={<LegalMentions />} />
          <Route path="/confidentialite" element={<PrivacyPolicy />} />
          <Route path="/conditions-generales" element={<TermsPage />} />
          <Route path="/blog/:slug" element={<LegacyBlogArticleRoute />} />
          <Route path="/camion-pizza-moselle" element={<LocalSeoPage cityKey="moselle" />} />
          <Route path="/food-truck-pizza-moselle" element={<Navigate to="/camion-pizza-moselle" replace />} />
          <Route path="/pizza" element={<PizzaPage />} />
          <Route path="/pizza/:city" element={<LegacyPizzaCityRoute />} />
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          <Route
            path="/order"
            element={
              <PrivateRoute>
                <Order />
              </PrivateRoute>
            }
          />
          <Route
            path="/order/confirmation"
            element={
              <PrivateRoute>
                <OrderConfirmation />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <PrivateRoute>
                <Profile />
              </PrivateRoute>
            }
          />
          <Route
            path="/userorders"
            element={
              <PrivateRoute>
                <UserOrders />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Dashboard>
                  <p className="rounded-xl border border-stone-200 bg-white p-4 text-stone-700">
                    {tr(
                      "Sélectionnez une section dans le menu administrateur.",
                      "Select an admin section from the menu."
                    )}
                  </p>
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/orders"
            element={
              <AdminRoute>
                <Dashboard>
                  <OrderList />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <Dashboard>
                  <Users />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/menu"
            element={
              <AdminRoute>
                <Dashboard>
                  <Products />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/ingredients"
            element={
              <AdminRoute>
                <Dashboard>
                  <Ingredients />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/locations"
            element={<Navigate to="/admin/timeslots#emplacements" replace />}
          />
          <Route
            path="/admin/timeslots"
            element={
              <AdminRoute>
                <Dashboard>
                  <TimeslotsAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/gallery"
            element={
              <AdminRoute>
                <Dashboard>
                  <GalleryTabsAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/gallery-hero"
            element={<Navigate to="/admin/gallery?tab=hero" replace />}
          />
          <Route
            path="/admin/gallery-menu"
            element={<Navigate to="/admin/gallery?tab=menu" replace />}
          />
          <Route
            path="/admin/print"
            element={
              <AdminRoute>
                <Dashboard>
                  <PrintAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tickets"
            element={
              <AdminRoute>
                <Dashboard>
                  <TicketsAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/blog"
            element={
              <AdminRoute>
                <Dashboard>
                  <BlogAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/faq"
            element={
              <AdminRoute>
                <Dashboard>
                  <FaqAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/site-info"
            element={
              <AdminRoute>
                <Dashboard>
                  <SiteInfoAdmin />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route
            path="/admin/editproduct/:id"
            element={
              <AdminRoute>
                <Dashboard>
                  <EditProduct />
                </Dashboard>
              </AdminRoute>
            }
          />
          <Route path="*" element={<CatchAllRoute />} />
        </Route>
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
            <CartProvider>
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </CartProvider>
          </SiteSettingsProvider>
        </LanguageProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
