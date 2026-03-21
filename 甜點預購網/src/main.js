import { jsx as _jsx } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AppProvider } from '@context/AppContext';
import { App } from './App';
import './index.css';
ReactDOM.createRoot(document.getElementById('root')).render(_jsx(React.StrictMode, { children: _jsx(AppProvider, { children: _jsx(App, {}) }) }));
