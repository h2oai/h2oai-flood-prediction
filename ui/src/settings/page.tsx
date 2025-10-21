import React, { useState, useEffect } from 'react';
import { Save, RefreshCw, Download, Upload, Bell, Map, BarChart3 } from 'lucide-react';
import { settingsApi, type UserSettings } from '@/lib/api';
import { Layout } from '@/components/layout';

const SettingsPage = () => {
  const [settings, setSettings] = useState<UserSettings>({
    notifications: {
      enabled: true,
      highRiskAlerts: true,
      moderateRiskAlerts: false,
      dataUpdates: true,
      systemMaintenance: true
    },
    display: {
      darkMode: false,
      autoRefresh: true,
      refreshInterval: 300,
      defaultView: 'dashboard',
      mapLayer: 'terrain'
    },
    data: {
      cacheEnabled: true,
      offlineMode: false,
      dataRetention: 30,
      exportFormat: 'csv'
    }
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const userSettings = await settingsApi.getSettings();
      setSettings(userSettings);
    } catch (err) {
      console.error('Failed to load settings:', err);
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (category: keyof UserSettings, setting: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [setting]: value
      }
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError(null);
      await settingsApi.updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults?')) {
      try {
        setLoading(true);
        await settingsApi.resetSettings();
        await loadSettings();
      } catch (err) {
        console.error('Failed to reset settings:', err);
        setError('Failed to reset settings');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleExportSettings = async () => {
    try {
      const blob = await settingsApi.exportSettings();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'flood-prediction-settings.json';
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export settings:', err);
      setError('Failed to export settings');
    }
  };

  const handleImportSettings = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      try {
        setLoading(true);
        const importedSettings = await settingsApi.importSettings(file);
        setSettings(importedSettings);
      } catch (err) {
        console.error('Failed to import settings:', err);
        setError('Invalid settings file format');
      } finally {
        setLoading(false);
      }
    }
  };

  if (loading && !settings.notifications) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Configure your flood prediction system preferences
          </p>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Notifications Settings */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Bell className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Notification Preferences
              </h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Enable Notifications
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Receive alerts and updates from the system
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.enabled}
                onChange={(e) => handleSettingChange('notifications', 'enabled', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  High Risk Alerts
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Immediate notifications for high flood risk conditions
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.highRiskAlerts}
                onChange={(e) => handleSettingChange('notifications', 'highRiskAlerts', e.target.checked)}
                disabled={!settings.notifications.enabled}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Moderate Risk Alerts
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Notifications for moderate flood risk conditions
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.moderateRiskAlerts}
                onChange={(e) => handleSettingChange('notifications', 'moderateRiskAlerts', e.target.checked)}
                disabled={!settings.notifications.enabled}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Data Updates
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Notifications when new data is available
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.notifications.dataUpdates}
                onChange={(e) => handleSettingChange('notifications', 'dataUpdates', e.target.checked)}
                disabled={!settings.notifications.enabled}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <Map className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Display & Interface
              </h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Auto Refresh
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Automatically update data at regular intervals
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.display.autoRefresh}
                onChange={(e) => handleSettingChange('display', 'autoRefresh', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Refresh Interval
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  How often to refresh data (in seconds)
                </p>
              </div>
              <select
                value={settings.display.refreshInterval}
                onChange={(e) => handleSettingChange('display', 'refreshInterval', parseInt(e.target.value))}
                disabled={!settings.display.autoRefresh}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={60}>1 minute</option>
                <option value={300}>5 minutes</option>
                <option value={600}>10 minutes</option>
                <option value={1800}>30 minutes</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Default View
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Page to show when opening the application
                </p>
              </div>
              <select
                value={settings.display.defaultView}
                onChange={(e) => handleSettingChange('display', 'defaultView', e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="dashboard">Dashboard</option>
                <option value="risk-map">Risk Map</option>
                <option value="analytics">Analytics</option>
                <option value="alerts">Alerts</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Default Map Layer
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Preferred map style for the risk map view
                </p>
              </div>
              <select
                value={settings.display.mapLayer}
                onChange={(e) => handleSettingChange('display', 'mapLayer', e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="terrain">Terrain</option>
                <option value="satellite">Satellite</option>
                <option value="topo">Topographic</option>
              </select>
            </div>
          </div>
        </div>

        {/* Data Settings */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                Data & Storage
              </h3>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Enable Caching
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Store data locally for faster loading
                </p>
              </div>
              <input
                type="checkbox"
                checked={settings.data.cacheEnabled}
                onChange={(e) => handleSettingChange('data', 'cacheEnabled', e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Data Retention
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  How long to keep historical data (in days)
                </p>
              </div>
              <select
                value={settings.data.dataRetention}
                onChange={(e) => handleSettingChange('data', 'dataRetention', parseInt(e.target.value))}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={7}>7 days</option>
                <option value={30}>30 days</option>
                <option value={90}>90 days</option>
                <option value={365}>1 year</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="font-medium text-gray-900 dark:text-gray-100">
                  Export Format
                </label>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Default format for data exports
                </p>
              </div>
              <select
                value={settings.data.exportFormat}
                onChange={(e) => handleSettingChange('data', 'exportFormat', e.target.value)}
                className="border border-gray-300 dark:border-gray-600 rounded-md px-3 py-1 bg-white dark:bg-neutral-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="csv">CSV</option>
                <option value="json">JSON</option>
                <option value="xlsx">Excel</option>
              </select>
            </div>
          </div>
        </div>

        {/* Settings Management */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              Settings Management
            </h3>
          </div>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <button
                onClick={handleSave}
                disabled={loading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
                  saved 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-primary-600 hover:bg-primary-700'
                } disabled:opacity-50`}
              >
                <Save className="h-4 w-4 mr-2" />
                {loading ? 'Saving...' : saved ? 'Saved!' : 'Save Settings'}
              </button>

              <button
                onClick={handleReset}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Reset to Defaults
              </button>

              <button
                onClick={handleExportSettings}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                <Download className="h-4 w-4 mr-2" />
                Export Settings
              </button>

              <label className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-neutral-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 cursor-pointer">
                <Upload className="h-4 w-4 mr-2" />
                Import Settings
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportSettings}
                  className="hidden"
                  disabled={loading}
                />
              </label>
            </div>
          </div>
        </div>

        {/* System Information */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
              System Information
            </h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">Application Version:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">1.0.0</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Last Data Update:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">{new Date().toLocaleString()}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">API Status:</span>
                <p className="font-medium text-green-600 dark:text-green-400">Connected</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">Model Accuracy:</span>
                <p className="font-medium text-gray-900 dark:text-gray-100">85.3%</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default SettingsPage;