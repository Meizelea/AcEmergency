import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../components/header';
import {
  Megaphone, Plus, Search, Eye, Edit3, Trash2, X,
  Image as ImageIcon, Video, AlertCircle, CheckCircle, Loader2,
  MapPin, FileText, RefreshCw, AlertTriangle
} from 'lucide-react';

const targetHostname = window.location.hostname || '127.0.0.1';

const API_BASE = 'https://api.aksyon.online';
//const API_BASE = `http://${targetHostname}:8000`;

// CACHE KEYS
const CACHE_KEY_ANNOUNCEMENTS = 'cache_admin_announcements_v1';

export default function AnnouncementPage() {
  const navigate = useNavigate();

  const [announcements, setAnnouncements] = useState(() => {
    const cached = sessionStorage.getItem(CACHE_KEY_ANNOUNCEMENTS);
    return cached ? JSON.parse(cached) : [];
  });
  const [loading, setLoading] = useState(() => announcements.length === 0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [fetchingVideo, setFetchingVideo] = useState(false);

  // Confirmation Decision Modal State
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    action: null
  });

  // Video URL Cache Ref
  const videoCache = useRef({});

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mediaFile: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  const getAuthHeaders = useCallback((isJson = true) => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    const headers = {};

    if (cleanToken) {
      headers['Authorization'] = `Token ${cleanToken}`;
    }
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  }, []);

  const fetchAnnouncements = useCallback(async (silent = false) => {
    try {
      if (!silent && announcements.length === 0) setLoading(true);
      setIsSyncing(true);

      let res = await fetch(`${API_BASE}/api/announcements/admin/`, {
        headers: getAuthHeaders(),
      });

      if (res.status === 401) {
        const rawToken = localStorage.getItem('ac_token') || '';
        const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
        res = await fetch(`${API_BASE}/api/announcements/admin/`, {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
        });
      }

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      const rawList = Array.isArray(data) ? data : data.results || [];
      
      setAnnouncements(rawList);
      sessionStorage.setItem(CACHE_KEY_ANNOUNCEMENTS, JSON.stringify(rawList));
    } catch (err) {
      console.error('Fetch announcements failure:', err);
      setFeedback({ error: 'Failed to fetch announcements. Verify credentials and assigned barangay.', success: '' });
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [getAuthHeaders, announcements.length]);

  // AUTOMATIC REFRESH AND POLLING (15s interval + Window Focus sync)
  useEffect(() => {
    const token = localStorage.getItem('ac_token');
    if (!token) {
      navigate('/login');
      return;
    }

    fetchAnnouncements(true);

    const interval = setInterval(() => {
      fetchAnnouncements(true);
    }, 15000);

    const handleFocus = () => fetchAnnouncements(true);
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [navigate, fetchAnnouncements]);

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((item) => {
      const q = searchTerm.toLowerCase();
      return (
        item.title?.toLowerCase().includes(q) ||
        item.content?.toLowerCase().includes(q) ||
        item.barangay?.toLowerCase().includes(q)
      );
    });
  }, [announcements, searchTerm]);

  const handleOpenForm = (announcement = null) => {
    if (announcement) {
      setSelectedAnnouncement(announcement);
      setFormData({
        title: announcement.title || '',
        content: announcement.content || '',
        mediaFile: null,
      });
    } else {
      setSelectedAnnouncement(null);
      setFormData({
        title: '',
        content: '',
        mediaFile: null,
      });
    }
    setFeedback({ error: '', success: '' });
    setIsFormModalOpen(true);
  };

  const handleOpenDetail = async (announcement) => {
    setSelectedAnnouncement(announcement);
    setActiveVideoUrl(null);
    setIsDetailModalOpen(true);

    if (announcement.video_thumbnail_url) {
      if (videoCache.current[announcement.id]) {
        setActiveVideoUrl(videoCache.current[announcement.id]);
        return;
      }

      setFetchingVideo(true);
      try {
        const res = await fetch(`${API_BASE}/api/announcements/admin/${announcement.id}/video-url/`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.video_url) {
            videoCache.current[announcement.id] = data.video_url;
            setActiveVideoUrl(data.video_url);
          }
        }
      } catch (err) {
        console.error('Failed to load signed video URL:', err);
      } finally {
        setFetchingVideo(false);
      }
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, mediaFile: file }));
    }
  };

  const uploadMediaToSupabase = async (announcementId, file) => {
    const urlRes = await fetch(`${API_BASE}/api/announcements/admin/media-upload-url/`, {
      method: 'POST',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        announcement_id: announcementId,
        content_type: file.type,
      }),
    });

    if (!urlRes.ok) {
      const errData = await urlRes.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || 'Failed to acquire upload authorization');
    }

    const { upload_url, path, token: uploadToken } = await urlRes.json();
    if (!upload_url) throw new Error('Signed upload URL was empty.');

    const uploadHeaders = {
      'Content-Type': file.type,
    };
    if (uploadToken) {
      uploadHeaders['Authorization'] = `Bearer ${uploadToken}`;
    }

    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: uploadHeaders,
      body: file,
    });

    if (!uploadRes.ok) {
      const retryPost = await fetch(upload_url, {
        method: 'POST',
        headers: uploadHeaders,
        body: file,
      });
      if (!retryPost.ok) throw new Error('Failed to upload file to storage bucket.');
    }

    const patchRes = await fetch(`${API_BASE}/api/announcements/admin/${announcementId}/`, {
      method: 'PATCH',
      headers: getAuthHeaders(true),
      body: JSON.stringify({
        media: path,
      }),
    });

    if (!patchRes.ok) throw new Error('Failed to associate media path with announcement.');
  };

  // Internal Execution: Save or Update Announcement
  const executeFormSubmit = async () => {
    setSubmitting(true);
    setFeedback({ error: '', success: '' });

    try {
      const isEditing = Boolean(selectedAnnouncement && selectedAnnouncement.id);
      const endpoint = isEditing
        ? `${API_BASE}/api/announcements/admin/${selectedAnnouncement.id}/`
        : `${API_BASE}/api/announcements/admin/`;
      const method = isEditing ? 'PATCH' : 'POST';

      const payload = {
        title: formData.title.trim(),
        content: formData.content.trim(),
      };

      const res = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(true),
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        const msg = errJson.detail || errJson.error || JSON.stringify(errJson) || 'Failed to save announcement details.';
        throw new Error(msg);
      }

      const savedRecord = await res.json();
      const targetId = isEditing ? selectedAnnouncement.id : savedRecord.id;

      if (formData.mediaFile && targetId) {
        await uploadMediaToSupabase(targetId, formData.mediaFile);
      }

      setFeedback({
        error: '',
        success: `Announcement ${isEditing ? 'updated' : 'published'} successfully!`,
      });
      setIsFormModalOpen(false);
      setSelectedAnnouncement(null);
      await fetchAnnouncements(true);
    } catch (err) {
      console.error('Submit form error:', err);
      setFeedback({ error: err.message || 'Operation failed.', success: '' });
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Confirmation: Save or Update
  const requestFormSubmit = (e) => {
    e.preventDefault();
    const isEditing = Boolean(selectedAnnouncement && selectedAnnouncement.id);
    
    setConfirmModal({
      isOpen: true,
      title: isEditing ? 'Update Announcement' : 'Publish Announcement',
      message: isEditing 
        ? `Are you sure you want to update the details for "${formData.title}"?`
        : `Are you sure you want to publish the new announcement "${formData.title}"?`,
      confirmText: isEditing ? 'Update' : 'Publish',
      action: executeFormSubmit
    });
  };

  // Internal Execution: Delete Announcement
  const executeDelete = async (targetAnnouncement) => {
    const announcementToDelete = targetAnnouncement || selectedAnnouncement;
    if (!announcementToDelete) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/announcements/admin/${announcementToDelete.id}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(false),
      });

      if (!res.ok) throw new Error('Failed to delete announcement record.');

      setFeedback({ error: '', success: 'Announcement deleted successfully.' });
      setIsDetailModalOpen(false);
      setSelectedAnnouncement(null);
      fetchAnnouncements(true);
    } catch (err) {
      setFeedback({ error: 'Failed to delete record.', success: '' });
    } finally {
      setSubmitting(false);
    }
  };

  // Trigger Confirmation: Delete Announcement
  const requestDelete = (announcement) => {
    const target = announcement || selectedAnnouncement;
    if (!target) return;

    setConfirmModal({
      isOpen: true,
      title: 'Delete Announcement',
      message: `Are you sure you want to remove "${target.title}"? This action cannot be reversed.`,
      confirmText: 'Delete Announcement',
      action: () => executeDelete(target)
    });
  };

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f3f4f6] font-sans text-gray-800 flex flex-col">
        
        {feedback.error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shrink-0">
            <AlertCircle size={16} /> {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-xs font-semibold shrink-0">
            <CheckCircle size={16} /> {feedback.success}
          </div>
        )}

        {/* CONTROLS HEADER */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search announcement, keyword, or brgy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#b32d2d] shadow-xs"
            />
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              onClick={() => fetchAnnouncements(false)}
              disabled={isSyncing}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw size={14} className={isSyncing ? "animate-spin text-[#b32d2d]" : ""} /> 
              {isSyncing ? "Syncing..." : "Sync Data"}
            </button>

            <button
              onClick={() => handleOpenForm()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-[#b32d2d] hover:bg-[#962626] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-95 cursor-pointer"
            >
              <Plus size={16} /> Post Announcement
            </button>
          </div>
        </div>

        {/* DIRECTORY TABLE CONTAINER */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-3">
              <Megaphone className="text-[#b32d2d]" size={20} />
              <h2 className="text-sm sm:text-base font-bold text-gray-800 tracking-tight">
                Public Announcements Directory
              </h2>
            </div>
            {/* BOLD COUNTER */}
            <span className="text-xs font-black text-gray-900">
              {filteredAnnouncements.length} Enrolled Bulletins
            </span>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                {/* BOLD TABLE HEADERS */}
                <tr className="border-b border-gray-200 bg-gray-50/50 text-xs font-black text-gray-900 uppercase tracking-wider select-none">
                  <th className="py-3.5 px-4 sm:px-6 w-16">ID</th>
                  <th className="py-3.5 px-4 sm:px-6">ANNOUNCEMENT DETAILS</th>
                  <th className="py-3.5 px-4 sm:px-6">ASSIGNED BARANGAY</th>
                  <th className="py-3.5 px-6">ATTACHMENT</th>
                  <th className="py-3.5 px-4 sm:px-6">DATE PUBLISHED</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-bold">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={18} />
                      Loading announcement records...
                    </td>
                  </tr>
                ) : filteredAnnouncements.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400 font-medium">
                      No announcements matched.
                    </td>
                  </tr>
                ) : (
                  filteredAnnouncements.map((item) => (
                    <tr 
                      key={item.id} 
                      onClick={() => handleOpenDetail(item)}
                      className="hover:bg-gray-50/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-4 sm:px-6 font-bold text-gray-500">
                        #{item.id}
                      </td>
                      <td className="py-4 px-4 sm:px-6 max-w-sm">
                        <div className="font-bold text-gray-900 text-sm group-hover:text-[#b32d2d] transition-colors">{item.title}</div>
                        <div className="text-gray-500 text-xs line-clamp-1 mt-0.5 font-medium">
                          {item.content}
                        </div>
                      </td>
                      <td className="py-4 px-4 sm:px-6">
                        <span className="flex items-center gap-1.5 text-gray-800 font-bold">
                          <MapPin size={14} className="text-red-500 shrink-0" />
                          {item.barangay ? `Brgy. ${item.barangay}` : 'Brgy. Not Specified'}
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        {item.image_url ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-blue-600">
                            <ImageIcon size={12} /> Image
                          </span>
                        ) : item.video_thumbnail_url ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-600">
                            <Video size={12} /> Video
                          </span>
                        ) : (
                          <span className="text-gray-400 text-[11px] font-bold">—</span>
                        )}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-gray-700 font-bold">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="py-4 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDetail(item);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                          >
                            <Eye size={13} />
                            VIEW FILE
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenForm(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="Edit Announcement"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              requestDelete(item);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-[#b32d2d] rounded-lg text-[11px] font-bold transition-all cursor-pointer"
                            title="Delete Announcement"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: View Details */}
        {isDetailModalOpen && selectedAnnouncement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shrink-0">
                <div>
                  <h3 className="text-sm sm:text-base font-bold text-gray-900">
                    Announcement #{selectedAnnouncement.id} — {selectedAnnouncement.title}
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {selectedAnnouncement.created_at ? new Date(selectedAnnouncement.created_at).toLocaleString() : ''}
                    {' • '}
                    <span className="font-bold text-red-600 uppercase">
                      {selectedAnnouncement.barangay ? `Brgy. ${selectedAnnouncement.barangay}` : 'Station Advisory'}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenForm(selectedAnnouncement);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      requestDelete(selectedAnnouncement);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-[#b32d2d] transition-colors cursor-pointer"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-4 sm:p-6 space-y-5 text-xs text-gray-600 overflow-y-auto flex-1">
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      ASSIGNED BARANGAY JURISDICTION
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {selectedAnnouncement.barangay ? `Brgy. ${selectedAnnouncement.barangay}` : 'Command Wide'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block mb-1">
                      LAST MODIFIED
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      {selectedAnnouncement.updated_at ? new Date(selectedAnnouncement.updated_at).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Advisory Content
                  </h4>
                  <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 text-sm text-gray-700 leading-relaxed whitespace-pre-line font-medium">
                    {selectedAnnouncement.content}
                  </div>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Media Attachment
                  </h4>
                  {fetchingVideo ? (
                    <div className="p-8 text-center text-gray-400">
                      <Loader2 className="animate-spin inline mr-2 text-[#b32d2d]" size={20} />
                      Generating secure media playback...
                    </div>
                  ) : activeVideoUrl ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-black/5 flex items-center justify-center max-h-80">
                      <video src={activeVideoUrl} controls autoPlay className="max-h-80 w-full object-contain" />
                    </div>
                  ) : selectedAnnouncement.image_url ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-black/5 flex items-center justify-center max-h-80">
                      <img src={selectedAnnouncement.image_url} alt="Attachment" className="max-h-80 w-full object-contain" />
                    </div>
                  ) : selectedAnnouncement.video_thumbnail_url ? (
                    <div className="relative w-full h-80 flex items-center justify-center bg-black rounded-xl overflow-hidden">
                      <img src={selectedAnnouncement.video_thumbnail_url} alt="Video Preview" className="max-h-80 w-full object-contain filter brightness-75" />
                      <div className="absolute flex flex-col items-center justify-center bg-black/60 px-4 py-2 rounded-lg text-white text-xs font-bold gap-1">
                        <Video size={20} className="text-red-500" />
                        <span>Video Processing</span>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-8 rounded-xl border border-dashed border-gray-200 text-center text-gray-400">
                      <FileText className="mx-auto mb-2 opacity-30" size={32} />
                      <span>No image or video attached with this announcement</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal: Create or Edit Announcement */}
        {isFormModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] my-auto">
              
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <h3 className="text-sm sm:text-base font-bold text-gray-800 flex items-center gap-2">
                  <Megaphone size={18} className="text-[#b32d2d]" />
                  {selectedAnnouncement ? 'Edit Announcement' : 'Post New Announcement'}
                </h3>
                <button
                  onClick={() => setIsFormModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={requestFormSubmit} className="p-4 sm:p-6 space-y-4 text-xs overflow-y-auto flex-1">
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Announcement Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g., Scheduled Road Closure along MacArthur Highway"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-[#b32d2d]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Advisory Content Details
                  </label>
                  <textarea
                    required
                    rows={5}
                    placeholder="Enter the official notification or emergency bulletin content..."
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    className="w-full p-3.5 rounded-xl border border-gray-200 text-xs text-gray-800 focus:outline-none focus:border-[#b32d2d] leading-relaxed"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1.5">
                    Attach Image or Video (Optional)
                  </label>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200 cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">
                    Accepted: JPG, PNG, WEBP, MP4, MOV. Direct Supabase pre-signed upload.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setIsFormModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#b32d2d] hover:bg-[#962626] transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 className="animate-spin" size={14} />}
                    {selectedAnnouncement ? 'Update Announcement' : 'Post Announcement'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>

      {/* CONFIRMATION DECISION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-full mb-4">
              <AlertTriangle size={28} />
            </div>
            
            <h3 className="font-extrabold text-base text-gray-900 mb-1">
              {confirmModal.title}
            </h3>
            
            <p className="text-xs text-gray-500 font-medium mb-6 leading-relaxed">
              {confirmModal.message}
            </p>

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs rounded-xl transition-all active:scale-95 cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                onClick={() => {
                  if (confirmModal.action) confirmModal.action();
                  setConfirmModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="flex-1 py-2.5 bg-[#b32d2d] hover:bg-[#8b2323] text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 cursor-pointer"
              >
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}