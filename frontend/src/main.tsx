import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { About } from './pages/About';
import { Assistant } from './pages/Assistant';
import { BudgetOptimizer } from './pages/BudgetOptimizer';
import { Contact } from './pages/Contact';
import { DestinationDetails } from './pages/DestinationDetails';
import { Destinations } from './pages/Destinations';
import { Governance } from './pages/Governance';
import { Home } from './pages/Home';
import { MyTrips } from './pages/MyTrips';
import { NotFound } from './pages/NotFound';
import { Packages } from './pages/Packages';
import { TripPlanner } from './pages/TripPlanner';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/destinations" element={<Destinations />} />
          <Route path="/destinations/:id" element={<DestinationDetails />} />
          <Route path="/packages" element={<Packages />} />
          <Route path="/planner" element={<TripPlanner />} />
          <Route path="/assistant" element={<Assistant />} />
          <Route path="/budget" element={<BudgetOptimizer />} />
          <Route path="/trips" element={<MyTrips />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/ai-governance" element={<Governance />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
