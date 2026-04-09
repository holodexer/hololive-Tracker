
import React, { useEffect, useState } from "react";
import { useSidebar } from "@/components/ui/sidebar";


const SIDEBAR_WIDTH = 240;
const SIDEBAR_WIDTH_ICON = 48; // 3rem
const SIDEBAR_STATE_KEY = 'sidebar:state';


const getSidebarState = () => {
  // 先查 localStorage，再查 cookie
  let state = localStorage.getItem(SIDEBAR_STATE_KEY);
  if (!state) {
    const match = document.cookie.match(/sidebar:state=(collapsed|expanded)/);
    state = match?.[1] || "expanded";
  }
  return state;
};

const Jellyfin = () => {
  const { state } = useSidebar?.() || { state: getSidebarState() };
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 800) return 0;
    return getSidebarState() === "collapsed" ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH;
  });
  const [animating, setAnimating] = useState(false);

  // 監聽 sidebar 狀態變化，並記錄到 localStorage
  useEffect(() => {
    if (state) localStorage.setItem(SIDEBAR_STATE_KEY, state);
    if (typeof window === 'undefined') return;
    setAnimating(true);
    if (window.innerWidth < 800) {
      setSidebarWidth(0);
    } else {
      setSidebarWidth(state === "collapsed" ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH);
    }
    // 動畫結束後移除 animating 樣式
    const timer = setTimeout(() => setAnimating(false), 180);
    return () => clearTimeout(timer);
  }, [state]);

  // 監聽視窗縮放
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 800) {
        setSidebarWidth(0);
      } else {
        setSidebarWidth((localStorage.getItem(SIDEBAR_STATE_KEY) || getSidebarState()) === "collapsed" ? SIDEBAR_WIDTH_ICON : SIDEBAR_WIDTH);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: sidebarWidth,
        width: `calc(100vw - ${sidebarWidth}px)`,
        height: '100vh',
        zIndex: 0,
        overflow: 'hidden',
        background: '#000',
        transition: animating ? 'left 180ms cubic-bezier(.4,0,.2,1), width 180ms cubic-bezier(.4,0,.2,1)' : 'none',
      }}
    >
      <iframe
        src="https://jellyfin.ksan.cloud/"
        title="Jellyfin"
        style={{
          border: 'none',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          background: '#000',
          display: 'block',
        }}
        sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
        allowFullScreen
      />
      <style>{`
        body, html, #root {
          overflow: hidden !important;
        }
        iframe::-webkit-scrollbar {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

export default Jellyfin;