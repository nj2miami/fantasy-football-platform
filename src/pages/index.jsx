import { Component, lazy, Suspense } from "react";
import Layout from "./Layout.jsx";
import { BrowserRouter as Router, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useQuery } from "@tanstack/react-query";
import { appClient } from "@/api/appClient";
import { createPageUrl } from "@/utils";

function lazyWithRetry(importer, chunkKey) {
    return lazy(async () => {
        try {
            return await importer();
        } catch (error) {
            const storageKey = `lazy-retry:${chunkKey}`;
            const hasRetried = window.sessionStorage.getItem(storageKey) === "true";
            const isChunkError = /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError/i.test(String(error?.message || error));
            if (isChunkError && !hasRetried) {
                window.sessionStorage.setItem(storageKey, "true");
                window.location.reload();
                return new Promise(() => {});
            }
            throw error;
        }
    });
}

const Dashboard = lazyWithRetry(() => import("./Dashboard"), "Dashboard");
const Players = lazyWithRetry(() => import("./Players"), "Players");
const Leagues = lazyWithRetry(() => import("./Leagues"), "Leagues");
const CreateLeague = lazyWithRetry(() => import("./CreateLeague"), "CreateLeague");
const Profile = lazyWithRetry(() => import("./Profile"), "Profile");
const Admin = lazyWithRetry(() => import("./Admin"), "Admin");
const LeagueManage = lazyWithRetry(() => import("./LeagueManage"), "LeagueManage");
const League = lazyWithRetry(() => import("./League"), "League");
const LeagueDraft = lazyWithRetry(() => import("./LeagueDraft"), "LeagueDraft");
const Home = lazyWithRetry(() => import("./Home"), "Home");
const PlayerStats = lazyWithRetry(() => import("./PlayerStats"), "PlayerStats");
const Team = lazyWithRetry(() => import("./Team"), "Team");
const Login = lazyWithRetry(() => import("./Login"), "Login");

const PAGES = {
    Dashboard,
    Players,
    Leagues,
    CreateLeague,
    Profile,
    Admin,
    LeagueManage,
    League,
    LeagueDraft,
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

class RouteErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidUpdate(previousProps) {
        if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div className="max-w-4xl mx-auto px-4">
                <div className="neo-card bg-white p-8 text-center">
                    <h1 className="text-2xl font-black uppercase text-orange-600">Page Load Failed</h1>
                    <p className="mt-2 font-bold text-gray-600">
                        The app hit a client-side loading error. Refreshing should recover the latest production bundle.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="neo-btn mt-5 bg-black px-6 py-3 font-black uppercase text-white"
                    >
                        Refresh
                    </button>
                </div>
            </div>
        );
    }
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
            <RouteErrorBoundary resetKey={location.key}>
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
                        <Route path="/league/draft" element={<LeagueDraft />} />
                        <Route path="/Home" element={<Home />} />
                        <Route path="/PlayerStats" element={<PlayerStats />} />
                        <Route path="/Team" element={<Team />} />
                        <Route path="/Login" element={<Login />} />
                    </Routes>
                </Suspense>
            </RouteErrorBoundary>
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
