
import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Search, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";

const OFFL_MARK_SRC = "/assets/OFFL-nav-logo.png";

export default function Layout({ children }) {
  const location = useLocation();
  const path = location.pathname.toLowerCase();
  const hideHeader = path === "/" || path === createPageUrl("Home").toLowerCase() || path === createPageUrl("Login").toLowerCase();

  return (
    <div className="min-h-screen bg-[#FAFAF9] relative">
      <div 
        className="absolute inset-0 w-full h-full opacity-5"
        style={{
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0) 98%, #000 98%),
            linear-gradient(90deg, rgba(0,0,0,0) 98%, #000 98%)
          `,
          backgroundSize: '50px 50px',
          backgroundPosition: '25px 25px',
          backgroundColor: '#4B843F',
        }}
      ></div>
      <div className="relative z-10">
      <style>{`
        * {
          --neo-border: 3.5px solid #000;
          --neo-shadow: 6px 6px 0px #000;
          --neo-shadow-lg: 8px 8px 0px #000;
          --neo-shadow-color: #000; /* Default shadow color */
        }
        
        .neo-border {
          border: var(--neo-border);
        }
        
        .neo-shadow {
          box-shadow: 6px 6px 0px var(--neo-shadow-color);
        }
        
        .neo-shadow-lg {
          box-shadow: 8px 8px 0px var(--neo-shadow-color);
        }
        
        .neo-btn {
          border: var(--neo-border);
          box-shadow: 6px 6px 0px var(--neo-shadow-color);
          transition: all 0.15s ease;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .neo-btn:hover {
          transform: translate(2px, 2px);
          box-shadow: 4px 4px 0px var(--neo-shadow-color);
        }
        
        .neo-btn:active {
          transform: translate(6px, 6px);
          box-shadow: 0px 0px 0px var(--neo-shadow-color);
        }
        
        .neo-card {
          border: var(--neo-border);
          box-shadow: var(--neo-shadow-lg);
          background: white;
        }
      `}</style>

      {!hideHeader && (
        <header className="bg-[#FF6B35] neo-border border-t-0 border-l-0 border-r-0 py-3">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <Link to={createPageUrl("Home")} className="flex items-center gap-3">
              <img
                src={OFFL_MARK_SRC}
                alt="Offseason Fantasy Football League"
                className="h-14 sm:h-16 w-auto max-w-[240px] sm:max-w-[320px] object-contain object-left"
              />
            </Link>
            <nav className="flex flex-wrap gap-2">
              <Link to={createPageUrl("Dashboard")}>
                <Button className="neo-btn bg-black text-[#F7B801] hover:bg-black">
                  <LayoutDashboard className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <Link to={createPageUrl("Leagues")}>
                <Button className="neo-btn bg-white text-black hover:bg-white">
                  <Trophy className="w-4 h-4 mr-2" />
                  Leagues
                </Button>
              </Link>
              <Link to={createPageUrl("Players")}>
                <Button className="neo-btn bg-white text-black hover:bg-white">
                  <Search className="w-4 h-4 mr-2" />
                  Players
                </Button>
              </Link>
            </nav>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-black text-white neo-border border-b-0 border-l-0 border-r-0 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-[#F7B801] font-black text-lg uppercase tracking-wide">
            Offseason Fantasy Football
          </p>
          <p className="text-sm mt-2 opacity-80">
            Historical stats. Modern mayhem.
          </p>
        </div>
      </footer>
      </div>
    </div>
  );
}
