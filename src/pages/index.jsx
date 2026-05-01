import { lazy, Suspense } from "react";
import Layout from "./Layout.jsx";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { createPageUrl } from "@/utils";

const Dashboard = lazy(() => import("./Dashboard"));
const Players = lazy(() => import("./Players"));
const Leagues = lazy(() => import("./Leagues"));
const CreateLeague = lazy(() => import("./CreateLeague"));
const Profile = lazy(() => import("./Profile"));
const Admin = lazy(() => import("./Admin"));
const LeagueManage = lazy(() => import("./LeagueManage"));
const League = lazy(() => import("./League"));
const Home = lazy(() => import("./Home"));
const PlayerStats = lazy(() => import("./PlayerStats"));
const Team = lazy(() => import("./Team"));
const Login = lazy(() => import("./Login"));

const PAGES = {
    Dashboard,
    Players,
    Leagues,
    CreateLeague,
    Profile,
    Admin,
    LeagueManage,
    League,
    Home,
    PlayerStats,
    Team,
    Login,
}

function RouteLoadingFallback() {
    return (
        <div className="max-w-4xl mx-auto px-4">
            <div className="neo-card bg-white p-8 font-black uppercase text-center">Loading...</div>
        </div>
    );
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    const publicPaths = ["/", createPageUrl("Home"), createPageUrl("Login")];
    const isPublicProfile = location.pathname.toLowerCase() === createPageUrl("Profile").toLowerCase()
        && new URLSearchParams(location.search).has("name");
    const isPublicPath = isPublicProfile || publicPaths.some((path) => path.toLowerCase() === location.pathname.toLowerCase());
    const { data: user, isLoading } = useQuery({
        queryKey: ["auth-route-user"],
        queryFn: () => appClient.auth.me(),
    });

    if (isLoading) {
        return (
            <Layout currentPageName={currentPage}>
                <div className="max-w-4xl mx-auto px-4">
                    <div className="neo-card bg-white p-8 font-black uppercase text-center">Loading...</div>
                </div>
            </Layout>
        );
    }

    if (!user && !isPublicPath) {
        return <Navigate to={createPageUrl("Login")} replace state={{ from: location }} />;
    }

    if (user && location.pathname.toLowerCase() === createPageUrl("Login").toLowerCase()) {
        return <Navigate to={createPageUrl("Dashboard")} replace />;
    }
    
    return (
        <Layout currentPageName={currentPage}>
            <Suspense fallback={<RouteLoadingFallback />}>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/Dashboard" element={<Dashboard />} />
                    <Route path="/Players" element={<Players />} />
                    <Route path="/Leagues" element={<Leagues />} />
                    <Route path="/CreateLeague" element={<CreateLeague />} />
                    <Route path="/Profile" element={<Profile />} />
                    <Route path="/Admin" element={<Admin />} />
                    <Route path="/LeagueManage" element={<LeagueManage />} />
                    <Route path="/League" element={<League />} />
                    <Route path="/Home" element={<Home />} />
                    <Route path="/PlayerStats" element={<PlayerStats />} />
                    <Route path="/Team" element={<Team />} />
                    <Route path="/Login" element={<Login />} />
                </Routes>
            </Suspense>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}
