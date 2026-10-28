import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { FullPageSpinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import Checkout from "./pages/checkout/Checkout";

const Landing = lazy(() => import("./pages/Landing"));
const Auth = lazy(() => import("./pages/Auth"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const Docs = lazy(() => import("./pages/Docs"));
const LinkStatus = lazy(() => import("./pages/checkout/LinkStatus"));
const DashboardLayout = lazy(() => import("./layouts/DashboardLayout"));
const Home = lazy(() => import("./pages/dashboard/Home"));
const Orders = lazy(() => import("./pages/dashboard/Orders"));
const OrderDetail = lazy(() => import("./pages/dashboard/OrderDetail"));
const Payments = lazy(() => import("./pages/dashboard/Payments"));
const Refunds = lazy(() => import("./pages/dashboard/Refunds"));
const PaymentLinks = lazy(() => import("./pages/dashboard/PaymentLinks"));
const QuickCollect = lazy(() => import("./pages/dashboard/QuickCollect"));
const Verification = lazy(() => import("./pages/dashboard/Verification"));
const Reports = lazy(() => import("./pages/dashboard/Reports"));
const ApiKeys = lazy(() => import("./pages/dashboard/developers/ApiKeys"));
const Webhooks = lazy(() => import("./pages/dashboard/developers/Webhooks"));
const Events = lazy(() => import("./pages/dashboard/developers/Events"));
const ApiLogs = lazy(() => import("./pages/dashboard/developers/ApiLogs"));
const BusinessSettings = lazy(() => import("./pages/dashboard/settings/Business"));
const UpiSettings = lazy(() => import("./pages/dashboard/settings/Upi"));
const CheckoutSettings = lazy(() => import("./pages/dashboard/settings/CheckoutBranding"));
const TeamSettings = lazy(() => import("./pages/dashboard/settings/Team"));
const SecuritySettings = lazy(() => import("./pages/dashboard/settings/Security"));

function RequireAuth({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!me) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { me, loading } = useAuth();
  if (loading) return <FullPageSpinner />;
  if (me) return <Navigate to={me.merchant.onboarding_completed ? "/dashboard" : "/onboarding"} replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullPageSpinner />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<GuestOnly><Auth kind="login" /></GuestOnly>} />
        <Route path="/signup" element={<GuestOnly><Auth kind="signup" /></GuestOnly>} />
        <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/pay/:ps" element={<Checkout />} />
        <Route path="/link-status/:code" element={<LinkStatus />} />
        <Route path="/dashboard" element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          <Route index element={<Home />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="payments" element={<Payments />} />
          <Route path="refunds" element={<Refunds />} />
          <Route path="payment-links" element={<PaymentLinks />} />
          <Route path="quick-collect" element={<QuickCollect />} />
          <Route path="verification" element={<Verification />} />
          <Route path="reports" element={<Reports />} />
          <Route path="developers" element={<Navigate to="api-keys" replace />} />
          <Route path="developers/api-keys" element={<ApiKeys />} />
          <Route path="developers/webhooks" element={<Webhooks />} />
          <Route path="developers/events" element={<Events />} />
          <Route path="developers/logs" element={<ApiLogs />} />
          <Route path="settings" element={<Navigate to="business" replace />} />
          <Route path="settings/business" element={<BusinessSettings />} />
          <Route path="settings/upi" element={<UpiSettings />} />
          <Route path="settings/checkout" element={<CheckoutSettings />} />
          <Route path="settings/team" element={<TeamSettings />} />
          <Route path="settings/security" element={<SecuritySettings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-6 text-center">
      <div>
        <p className="font-mono text-sm text-brand-600">404</p>
        <h1 className="mt-2 text-3xl font-semibold">This page doesn't exist</h1>
        <a href="/" className="mt-6 inline-block font-semibold text-brand-700 underline underline-offset-4">Go to the homepage</a>
      </div>
    </div>
  );
}
