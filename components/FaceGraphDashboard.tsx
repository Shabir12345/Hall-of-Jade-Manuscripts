import React, { useState, useEffect, useCallback } from 'react';
import { NovelState } from '../types';
import {
  getFaceGraphConfig,
  saveFaceGraphConfig,
  getAllFaceProfiles,
  getAllSocialLinks,
  getActiveBloodFeuds,
  getUnpaidDebts,
  getPendingRipples,
  initializeSocialLinksFromRelationships,
} from '../services/faceGraph';
import {
  findMostInfluentialCharacters,
  getNetworkStatistics,
  detectSocialClusters,
} from '../services/faceGraph/socialNetworkQueries';
import { fetchFaceGraphStats } from '../services/faceGraph/faceGraphPersistence';
import type {
  FaceProfile,
  SocialLink,
  BloodFeud,
  FaceDebt,
  KarmaRipple,
  FaceGraphConfig,
} from '../types/faceGraph';
import { DEFAULT_FACE_GRAPH_CONFIG } from '../types/faceGraph';
import { logger } from '../services/loggingService';

interface FaceGraphDashboardProps {
  novelState: NovelState | null;
}

type TabType = 'overview' | 'profiles' | 'socialNetwork' | 'karmaEvents' | 'settings';

export const FaceGraphDashboard: React.FC<FaceGraphDashboardProps> = ({ novelState }) => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [config, setConfig] = useState<FaceGraphConfig>(DEFAULT_FACE_GRAPH_CONFIG);
  const [profiles, setProfiles] = useState<FaceProfile[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [bloodFeuds, setBloodFeuds] = useState<BloodFeud[]>([]);
  const [debts, setDebts] = useState<FaceDebt[]>([]);
  const [ripples, setRipples] = useState<KarmaRipple[]>([]);
  const [stats, setStats] = useState<{
    totalProfiles: number;
    totalKarmaEvents: number;
    totalSocialLinks: number;
    activeBloodFeuds: number;
    unpaidDebts: number;
    pendingRipples: number;
  } | null>(null);
  const [networkStats, setNetworkStats] = useState<{
    totalNodes: number;
    totalEdges: number;
    averageConnectionsPerNode: number;
    mostConnectedCharacter: { id: string; name: string; connections: number } | null;
    totalPositiveKarma: number;
    totalNegativeKarma: number;
  } | null>(null);
  const [influentialCharacters, setInfluentialCharacters] = useState<Array<{
    characterId: string;
    characterName: string;
    totalFace: number;
    connectionCount: number;
    influenceScore: number;
  }>>([]);
  const [clusters, setClusters] = useState<Array<{
    clusterId: number;
    members: Array<{ characterId: string; characterName: string }>;
    dominantLinkTypes: string[];
  }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load data when novel state changes
  useEffect(() => {
    if (novelState) {
      loadFaceGraphData();
    }
  }, [novelState?.id]);

  const loadFaceGraphData = useCallback(async () => {
    if (!novelState) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load config
      const configData = await getFaceGraphConfig(novelState.id);
      setConfig(configData || DEFAULT_FACE_GRAPH_CONFIG);

      // Load all data in parallel
      const [
        profilesData,
        linksData,
        feudsData,
        debtsData,
        ripplesData,
        statsData,
        networkStatsData,
        influentialData,
        clustersData,
      ] = await Promise.all([
        getAllFaceProfiles(novelState.id),
        getAllSocialLinks(novelState.id),
        getActiveBloodFeuds(novelState.id),
        getUnpaidDebts(novelState.id),
        getPendingRipples(novelState.id),
        fetchFaceGraphStats(novelState.id),
        getNetworkStatistics(novelState.id),
        findMostInfluentialCharacters(novelState.id, 10),
        detectSocialClusters(novelState.id),
      ]);

      setProfiles(profilesData);
      setSocialLinks(linksData);
      setBloodFeuds(feudsData);
      setDebts(debtsData);
      setRipples(ripplesData);
      setStats(statsData);
      setNetworkStats(networkStatsData);
      setInfluentialCharacters(influentialData);
      setClusters(clustersData);

    } catch (err) {
      logger.error('Failed to load Face Graph data', 'FaceGraphDashboard', err instanceof Error ? err : new Error(String(err)));
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [novelState]);

  const handleInitializeFromRelationships = async () => {
    if (!novelState) return;

    setIsInitializing(true);
    setError(null);

    try {
      const result = await initializeSocialLinksFromRelationships(novelState);
      
      if (result.errors.length > 0) {
        setError(`Initialization completed with ${result.errors.length} errors`);
      }

      // Reload data
      await loadFaceGraphData();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Initialization failed');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!novelState) return;

    try {
      await saveFaceGraphConfig(novelState.id, config);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save config');
    }
  };

  if (!novelState) {
    return (
      <div className="p-6 text-center text-gray-500 dark:text-gray-400">
        <p>Select a novel to view Face Graph data</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Face Graph - Social Network Memory
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Track karma, reputation, and relationships across chapters
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadFaceGraphData}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          <button
            onClick={handleInitializeFromRelationships}
            disabled={isInitializing}
            className="px-3 py-1.5 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isInitializing ? 'Initializing...' : 'Initialize from Characters'}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-4">
          {(['overview', 'profiles', 'socialNetwork', 'karmaEvents', 'settings'] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`py-2 px-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              {tab === 'overview' && 'Overview'}
              {tab === 'profiles' && `Profiles (${profiles.length})`}
              {tab === 'socialNetwork' && 'Social Network'}
              {tab === 'karmaEvents' && 'Karma & Feuds'}
              {tab === 'settings' && 'Settings'}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-4">
        {activeTab === 'overview' && (
          <OverviewTab
            stats={stats}
            networkStats={networkStats}
            influentialCharacters={influentialCharacters}
            config={config}
          />
        )}
        {activeTab === 'profiles' && (
          <ProfilesTab profiles={profiles} />
        )}
        {activeTab === 'socialNetwork' && (
          <SocialNetworkTab
            links={socialLinks}
            clusters={clusters}
            networkStats={networkStats}
          />
        )}
        {activeTab === 'karmaEvents' && (
          <KarmaEventsTab
            bloodFeuds={bloodFeuds}
            debts={debts}
            ripples={ripples}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsTab
            config={config}
            setConfig={setConfig}
            onSave={handleSaveConfig}
          />
        )}
      </div>
    </div>
  );
};

// Tab Components

const OverviewTab: React.FC<{
  stats: any;
  networkStats: any;
  influentialCharacters: any[];
  config: FaceGraphConfig;
}> = ({ stats, networkStats, influentialCharacters, config }) => (
  <div className="space-y-6">
    {/* Status */}
    <div className="flex items-center gap-2">
      <span className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-500' : 'bg-gray-400'}`} />
      <span className="text-sm font-medium">
        {config.enabled ? 'Face Graph Active' : 'Face Graph Disabled'}
      </span>
    </div>

    {/* Stats Grid */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <StatCard label="Face Profiles" value={stats?.totalProfiles || 0} />
      <StatCard label="Social Links" value={stats?.totalSocialLinks || 0} />
      <StatCard label="Karma Events" value={stats?.totalKarmaEvents || 0} />
      <StatCard label="Blood Feuds" value={stats?.activeBloodFeuds || 0} color="red" />
      <StatCard label="Unpaid Debts" value={stats?.unpaidDebts || 0} color="yellow" />
      <StatCard label="Pending Ripples" value={stats?.pendingRipples || 0} color="purple" />
    </div>

    {/* Network Stats */}
    {networkStats && (
      <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded">
        <h4 className="font-medium mb-2">Network Analysis</h4>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Total Nodes:</span> {networkStats.totalNodes}
          </div>
          <div>
            <span className="text-gray-500">Total Edges:</span> {networkStats.totalEdges}
          </div>
          <div>
            <span className="text-gray-500">Avg Connections:</span> {networkStats.averageConnectionsPerNode}
          </div>
          <div>
            <span className="text-gray-500">Most Connected:</span>{' '}
            {networkStats.mostConnectedCharacter?.name || 'N/A'} ({networkStats.mostConnectedCharacter?.connections || 0})
          </div>
          <div>
            <span className="text-gray-500">Total Positive Karma:</span> +{networkStats.totalPositiveKarma}
          </div>
          <div>
            <span className="text-gray-500">Total Negative Karma:</span> -{networkStats.totalNegativeKarma}
          </div>
        </div>
      </div>
    )}

    {/* Influential Characters */}
    {influentialCharacters.length > 0 && (
      <div className="mt-4">
        <h4 className="font-medium mb-2">Most Influential Characters</h4>
        <div className="space-y-2">
          {influentialCharacters.slice(0, 5).map((char, index) => (
            <div key={char.characterId} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded">
              <div className="flex items-center gap-2">
                <span className="text-gray-400">#{index + 1}</span>
                <span className="font-medium">{char.characterName}</span>
              </div>
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span>Face: {char.totalFace}</span>
                <span>Links: {char.connectionCount}</span>
                <span className="font-medium text-blue-600">Score: {char.influenceScore}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )}
  </div>
);

const ProfilesTab: React.FC<{ profiles: FaceProfile[] }> = ({ profiles }) => (
  <div className="space-y-4">
    {profiles.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No Face Profiles yet. Initialize from character relationships to create profiles.</p>
    ) : (
      <div className="space-y-2">
        {profiles.map((profile) => (
          <div key={profile.id} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium">{profile.characterName}</span>
                <span className={`ml-2 px-2 py-0.5 text-xs rounded ${
                  profile.tier === 'mythical' ? 'bg-purple-100 text-purple-800' :
                  profile.tier === 'legendary' ? 'bg-yellow-100 text-yellow-800' :
                  profile.tier === 'famous' ? 'bg-blue-100 text-blue-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {profile.tier}
                </span>
              </div>
              <div className="text-sm text-gray-500">
                Total Face: <span className="font-medium">{profile.totalFace}</span>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              <span>Martial: {profile.faceByCategory.martial}</span>
              <span>Scholarly: {profile.faceByCategory.scholarly}</span>
              <span>Political: {profile.faceByCategory.political}</span>
              <span>Moral: {profile.faceByCategory.moral}</span>
              <span>Mysterious: {profile.faceByCategory.mysterious}</span>
              <span>Wealth: {profile.faceByCategory.wealth}</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Karma Balance: <span className={profile.karmaBalance >= 0 ? 'text-green-600' : 'text-red-600'}>
                {profile.karmaBalance >= 0 ? '+' : ''}{profile.karmaBalance}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const SocialNetworkTab: React.FC<{
  links: SocialLink[];
  clusters: any[];
  networkStats: any;
}> = ({ links, clusters, networkStats }) => (
  <div className="space-y-4">
    {/* Social Clusters */}
    {clusters.length > 0 && (
      <div className="mb-4">
        <h4 className="font-medium mb-2">Social Clusters</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {clusters.slice(0, 4).map((cluster) => (
            <div key={cluster.clusterId} className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
              <div className="font-medium text-sm">Cluster #{cluster.clusterId + 1}</div>
              <div className="text-xs text-gray-500 mt-1">
                Members: {cluster.members.map((m: any) => m.characterName).join(', ')}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                Dominant: {cluster.dominantLinkTypes.join(', ') || 'Mixed'}
              </div>
            </div>
          ))}
        </div>
      </div>
    )}

    {/* Links List */}
    <h4 className="font-medium">Social Links ({links.length})</h4>
    {links.length === 0 ? (
      <p className="text-gray-500 text-center py-8">No social links yet.</p>
    ) : (
      <div className="max-h-96 overflow-y-auto space-y-2">
        {links.map((link) => (
          <div key={link.id} className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-sm flex items-center justify-between">
            <div>
              <span className="font-medium">{link.sourceCharacterName}</span>
              <span className="mx-2 text-gray-400">→</span>
              <span className="font-medium">{link.targetCharacterName}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200 rounded">
                {link.linkType.replace('_', ' ')}
              </span>
              <span className={`text-xs ${
                link.sentimentScore > 0 ? 'text-green-600' : 
                link.sentimentScore < 0 ? 'text-red-600' : 'text-gray-500'
              }`}>
                {link.sentimentScore > 0 ? '+' : ''}{link.sentimentScore}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

const KarmaEventsTab: React.FC<{
  bloodFeuds: BloodFeud[];
  debts: FaceDebt[];
  ripples: KarmaRipple[];
}> = ({ bloodFeuds, debts, ripples }) => (
  <div className="space-y-6">
    {/* Blood Feuds */}
    <div>
      <h4 className="font-medium text-red-600 dark:text-red-400 mb-2">
        Active Blood Feuds ({bloodFeuds.length})
      </h4>
      {bloodFeuds.length === 0 ? (
        <p className="text-gray-500 text-sm">No active blood feuds</p>
      ) : (
        <div className="space-y-2">
          {bloodFeuds.map((feud) => (
            <div key={feud.id} className="p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-800">
              <div className="font-medium">{feud.feudName}</div>
              <div className="text-sm mt-1">
                <span className="text-gray-600 dark:text-gray-400">{feud.aggrievedPartyName}</span>
                <span className="mx-2">vs</span>
                <span className="text-gray-600 dark:text-gray-400">{feud.targetPartyName}</span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Cause: {feud.originalCause}
              </div>
              <div className="text-xs text-red-600 mt-1">
                Intensity: {feud.intensity}/100
              </div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Debts */}
    <div>
      <h4 className="font-medium text-yellow-600 dark:text-yellow-400 mb-2">
        Unpaid Debts ({debts.length})
      </h4>
      {debts.length === 0 ? (
        <p className="text-gray-500 text-sm">No unpaid debts</p>
      ) : (
        <div className="space-y-2">
          {debts.map((debt) => (
            <div key={debt.id} className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded border border-yellow-200 dark:border-yellow-800">
              <div className="flex justify-between items-center">
                <div>
                  <span className="font-medium">{debt.debtorName}</span>
                  <span className="mx-2 text-gray-400">owes</span>
                  <span className="font-medium">{debt.creditorName}</span>
                </div>
                <span className="text-xs bg-yellow-200 dark:bg-yellow-800 px-2 py-0.5 rounded">
                  {debt.debtType.replace('_', ' ')}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">{debt.description}</div>
              <div className="text-xs text-yellow-600 mt-1">Weight: {debt.debtWeight}</div>
            </div>
          ))}
        </div>
      )}
    </div>

    {/* Pending Ripples */}
    <div>
      <h4 className="font-medium text-purple-600 dark:text-purple-400 mb-2">
        Pending Ripples ({ripples.length})
      </h4>
      {ripples.length === 0 ? (
        <p className="text-gray-500 text-sm">No pending ripple effects</p>
      ) : (
        <div className="space-y-2">
          {ripples.map((ripple) => (
            <div key={ripple.id} className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
              <div className="font-medium">{ripple.affectedCharacterName}</div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Connected to {ripple.originalTargetName} via {ripple.connectionToTarget}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Degrees of separation: {ripple.degreesOfSeparation}
              </div>
              {ripple.becomesThreat && (
                <div className="text-xs text-red-600 mt-1">
                  ⚠️ May become a threat: {ripple.potentialResponse}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  </div>
);

const SettingsTab: React.FC<{
  config: FaceGraphConfig;
  setConfig: (config: FaceGraphConfig) => void;
  onSave: () => void;
}> = ({ config, setConfig, onSave }) => (
  <div className="space-y-4 max-w-md">
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">Enable Face Graph</label>
      <input
        type="checkbox"
        checked={config.enabled}
        onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
        className="toggle"
      />
    </div>

    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">Auto-Calculate Ripples</label>
      <input
        type="checkbox"
        checked={config.autoCalculateRipples}
        onChange={(e) => setConfig({ ...config, autoCalculateRipples: e.target.checked })}
        className="toggle"
      />
    </div>

    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">Auto-Extract Karma</label>
      <input
        type="checkbox"
        checked={config.autoExtractKarma}
        onChange={(e) => setConfig({ ...config, autoExtractKarma: e.target.checked })}
        className="toggle"
      />
    </div>

    <div>
      <label className="text-sm font-medium block mb-1">Max Ripple Degrees</label>
      <input
        type="number"
        min={1}
        max={5}
        value={config.maxRippleDegrees}
        onChange={(e) => setConfig({ ...config, maxRippleDegrees: parseInt(e.target.value) || 3 })}
        className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
      />
    </div>

    <div>
      <label className="text-sm font-medium block mb-1">Ripple Karma Threshold</label>
      <input
        type="number"
        min={10}
        max={100}
        value={config.rippleKarmaThreshold}
        onChange={(e) => setConfig({ ...config, rippleKarmaThreshold: parseInt(e.target.value) || 30 })}
        className="w-full px-3 py-2 border rounded dark:bg-gray-700 dark:border-gray-600"
      />
    </div>

    <button
      onClick={onSave}
      className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
    >
      Save Settings
    </button>
  </div>
);

// Helper Components

const StatCard: React.FC<{ label: string; value: number; color?: string }> = ({ label, value, color }) => (
  <div className={`p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 ${
    color === 'red' ? 'border-l-4 border-red-500' :
    color === 'yellow' ? 'border-l-4 border-yellow-500' :
    color === 'purple' ? 'border-l-4 border-purple-500' :
    ''
  }`}>
    <div className="text-2xl font-bold">{value}</div>
    <div className="text-xs text-gray-500 dark:text-gray-400">{label}</div>
  </div>
);

export default FaceGraphDashboard;
