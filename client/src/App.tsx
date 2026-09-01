import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import React, { lazy, Suspense } from "react";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import MobileAppChrome from "./components/MobileAppChrome";
import { ThemeProvider } from "./contexts/ThemeContext";
import Explorer from "./pages/Explorer";
import Home from "./pages/Home";
import LocalAuth from "./pages/LocalAuth";

const Feedback = lazy(() => import("./pages/Feedback"));
const Information = lazy(() => import("./pages/Information"));
const Trends = lazy(() => import("./pages/Trends"));

function Router() {
  return <Suspense fallback={<main className="section-page"><div className="trend-empty">Menyiapkan tampilan HealthAir…</div></main>}><Switch><Route path="/" component={Home} /><Route path="/login"><LocalAuth mode="login" /></Route><Route path="/register"><LocalAuth mode="register" /></Route><Route path="/explore" component={Explorer} /><Route path="/trends" component={Trends} /><Route path="/information" component={Information} /><Route path="/feedback" component={Feedback} /><Route path="/404" component={NotFound} /><Route component={NotFound} /></Switch></Suspense>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider defaultTheme="light"><TooltipProvider><Toaster /><Router /><MobileAppChrome /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
