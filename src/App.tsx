import React, { useState, useEffect } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { Navbar } from './components/Navbar';
import { LoginScreen } from './components/auth/LoginScreen';
import { OutletDashboard } from './components/outlet/OutletDashboard';
import { OutletOrderForm } from './components/outlet/OutletOrderForm';
import { RoleDashboard } from './components/dashboard/RoleDashboard';
import { MasterInventory } from './components/warehouse/MasterInventory';
import { InboundSection } from './components/warehouse/InboundSection';
import { OutbondSection } from './components/warehouse/OutbondSection';
import { PurchaseRequestSection } from './components/warehouse/PurchaseRequestSection';
import { VendorSection } from './components/warehouse/VendorSection';
import { CostControlSection } from './components/warehouse/CostControlSection';
import { AuditTrailSection } from './components/warehouse/AuditTrailSection';
import { SystemSettingSection } from './components/warehouse/SystemSettingSection';
import { DepartmentName, OutletOrder, User } from './types';
import { getDefaultTabForPosition } from './utils/authUtils';

function AppContent() {
  const { currentUser, canAccess, isAuthenticated } = useApp();

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<string>(() => {
    return getDefaultTabForPosition(currentUser.position);
  });

  // State for passing order to edit in OutletOrderForm
  const [orderToEdit, setOrderToEdit] = useState<OutletOrder | null>(null);
  const [orderPrefill, setOrderPrefill] = useState<{
    outletName: string;
    department: DepartmentName;
  } | null>(null);

  // Auto-route on role switch if current tab is unauthorized
  useEffect(() => {
    if (activeTab === 'audit-trail' || activeTab === 'system-setting') return;

    if (currentUser.position === 'Outlet') {
      if (activeTab !== 'dashboard-outlet' && activeTab !== 'order-outlet') {
        setActiveTab('dashboard-outlet');
      }
    } else if (currentUser.position === 'Storage-Mailer') {
      if (activeTab !== 'dashboard' && activeTab !== 'outbond') {
        setActiveTab('dashboard');
      }
    } else if (currentUser.position === 'Storage Inbound') {
      if (
        activeTab !== 'dashboard' &&
        activeTab !== 'inbound' &&
        activeTab !== 'master-inventory' &&
        activeTab !== 'purchase-request'
      ) {
        setActiveTab('dashboard');
      }
    } else if (currentUser.position === 'Storage Outbond') {
      if (
        activeTab !== 'dashboard' &&
        activeTab !== 'outbond' &&
        activeTab !== 'master-inventory' &&
        activeTab !== 'purchase-request'
      ) {
        setActiveTab('dashboard');
      }
    } else if (currentUser.position === 'Purchasing') {
      if (
        activeTab !== 'dashboard' &&
        activeTab !== 'purchase-request' &&
        activeTab !== 'vendor' &&
        activeTab !== 'inbound' &&
        activeTab !== 'cost-control'
      ) {
        setActiveTab('dashboard');
      }
    } else if (currentUser.position === 'Cost Control') {
      if (
        activeTab !== 'dashboard' &&
        activeTab !== 'cost-control' &&
        activeTab !== 'master-inventory' &&
        activeTab !== 'purchase-request' &&
        activeTab !== 'vendor'
      ) {
        setActiveTab('dashboard');
      }
    }
  }, [currentUser.position, activeTab]);

  const handleLoginSuccess = (user: User) => {
    const targetTab = getDefaultTabForPosition(user.position);
    setActiveTab(targetTab);
  };

  const handleNavigateToNewOrder = (prefill?: {
    outletName: string;
    department: DepartmentName;
  }) => {
    setOrderToEdit(null);
    setOrderPrefill(prefill || null);
    setActiveTab('order-outlet');
  };

  const handleViewOrderDetails = (order: OutletOrder) => {
    setOrderToEdit(order);
    setOrderPrefill(null);
    setActiveTab('order-outlet');
  };

  const handleBackToDashboard = () => {
    setOrderToEdit(null);
    setOrderPrefill(null);
    setActiveTab('dashboard-outlet');
  };

  // If user is not authenticated, show initial Login Screen
  if (!isAuthenticated) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  // Render view corresponding to activeTab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <RoleDashboard
            onNavigateTab={setActiveTab}
            onNavigateToOrderForm={handleNavigateToNewOrder}
            onViewOrderDetails={handleViewOrderDetails}
          />
        );

      case 'dashboard-outlet':
        return (
          <OutletDashboard
            onNavigateToOrderForm={handleNavigateToNewOrder}
            onViewOrderDetails={handleViewOrderDetails}
          />
        );

      case 'order-outlet':
        return (
          <OutletOrderForm
            initialOrderToEdit={orderToEdit}
            onBackToDashboard={handleBackToDashboard}
            prefill={orderPrefill}
          />
        );

      case 'master-inventory':
        return <MasterInventory />;

      case 'inbound':
        return <InboundSection />;

      case 'outbond':
        return <OutbondSection />;

      case 'purchase-request':
        return <PurchaseRequestSection />;

      case 'vendor':
        return <VendorSection />;

      case 'cost-control':
        return <CostControlSection />;

      case 'audit-trail':
        return <AuditTrailSection />;

      case 'system-setting':
        return <SystemSettingSection />;

      default:
        return currentUser.position === 'Outlet' ? (
          <OutletDashboard
            onNavigateToOrderForm={handleNavigateToNewOrder}
            onViewOrderDetails={handleViewOrderDetails}
          />
        ) : (
          <RoleDashboard
            onNavigateTab={setActiveTab}
            onNavigateToOrderForm={handleNavigateToNewOrder}
            onViewOrderDetails={handleViewOrderDetails}
          />
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-800">
      {/* Top Navbar */}
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Main Body Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {renderTabContent()}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
            <span>1010Group F&B Supply Chain • Multi-Outlet & Central Kitchen Integrated</span>
          </div>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Sistem Rantai Pasok Terpadu 4 Departemen</span>
            <span>•</span>
            <span>Excel Compatible Export</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
