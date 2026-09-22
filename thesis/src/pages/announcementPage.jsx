import React, { useState, useEffect, useMemo } from 'react';
import AdminLayout from '../components/header';
import {
  Megaphone, Plus, Search, Eye, Edit3, Trash2, X,
  Image as ImageIcon, Video, AlertCircle, CheckCircle, Loader2,
  MapPin, FileText
} from 'lucide-react';

const API_BASE = 'http://localhost:8000';

export default function AnnouncementPage() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
  const [activeVideoUrl, setActiveVideoUrl] = useState(null);
  const [fetchingVideo, setFetchingVideo] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    mediaFile: null,
  });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({ error: '', success: '' });

  // Get Auth Token Helper supporting standard DRF Token & Bearer JWT
  const getAuthHeaders = (isJson = true) => {
    const rawToken = localStorage.getItem('ac_token') || '';
    const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
    const headers = {};

    if (cleanToken) {
      // Use 'Token ' prefix for standard DRF / Knox TokenAuthentication
      headers['Authorization'] = `Token ${cleanToken}`;
    }
    if (isJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  // 1. Fetch announcements list
  const fetchAnnouncements = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/announcements/admin/`, {
        headers: getAuthHeaders(),
      });

      // Retry with Bearer prefix if Token prefix encounters 401
      if (res.status === 401) {
        const rawToken = localStorage.getItem('ac_token') || '';
        const cleanToken = rawToken.replace(/^(Token|Bearer)\s+/i, '').trim();
        const fallbackRes = await fetch(`${API_BASE}/api/announcements/admin/`, {
          headers: {
            'Authorization': `Bearer ${cleanToken}`,
            'Content-Type': 'application/json',
          },
        });
        if (!fallbackRes.ok) throw new Error(`HTTP error ${fallbackRes.status}`);
        const data = await fallbackRes.json();
        setAnnouncements(Array.isArray(data) ? data : data.results || []);
        return;
      }

      if (!res.ok) throw new Error(`HTTP error ${res.status}`);
      const data = await res.json();
      setAnnouncements(Array.isArray(data) ? data : data.results || []);
    } catch (err) {
      console.error('Fetch announcements failure:', err);
      setFeedback({ error: 'Failed to fetch announcements. Verify credentials and assigned barangay.', success: '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // Filtered list
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

  // Open Form Modal (Create or Edit)
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

  // Open Details Modal & fetch video URL if needed
  const handleOpenDetail = async (announcement) => {
    setSelectedAnnouncement(announcement);
    setActiveVideoUrl(null);
    setIsDetailModalOpen(true);

    if (announcement.video_thumbnail_url || (!announcement.image_url && announcement.media)) {
      setFetchingVideo(true);
      try {
        const res = await fetch(`${API_BASE}/api/announcements/admin/${announcement.id}/video-url/`, {
          headers: getAuthHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          setActiveVideoUrl(data.video_url);
        }
      } catch (err) {
        console.error('Failed to load video URL:', err);
      } finally {
        setFetchingVideo(false);
      }
    }
  };

  // Handle direct file input
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFormData((prev) => ({ ...prev, mediaFile: file }));
    }
  };

  // Upload file helper via pre-signed URL protocol
  const uploadMediaToSupabase = async (announcementId, file) => {
    const urlRes = await fetch(`${API_BASE}/api/announcements/admin/media-upload-url/`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        announcement_id: announcementId,
        content_type: file.type,
      }),
    });

    if (!urlRes.ok) {
      const errData = await urlRes.json().catch(() => ({}));
      throw new Error(errData.detail || errData.error || 'Failed to acquire upload authorization');
    }

    const { upload_url, path } = await urlRes.json();
    if (!upload_url) throw new Error('Signed upload URL was empty.');

    const uploadRes = await fetch(upload_url, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type,
      },
      body: file,
    });

    if (!uploadRes.ok) throw new Error('Failed to upload file to storage bucket.');

    const patchRes = await fetch(`${API_BASE}/api/announcements/admin/${announcementId}/`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({
        media: path,
      }),
    });

    if (!patchRes.ok) throw new Error('Failed to associate media path with announcement.');
  };

  // Submit Create or Edit
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback({ error: '', success: '' });

    try {
      const isEditing = Boolean(selectedAnnouncement);
      const endpoint = isEditing
        ? `${API_BASE}/api/announcements/admin/${selectedAnnouncement.id}/`
        : `${API_BASE}/api/announcements/admin/`;
      const method = isEditing ? 'PATCH' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: getAuthHeaders(),
        body: JSON.stringify({
          title: formData.title,
          content: formData.content,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.detail || errJson.error || 'Failed to save announcement details.');
      }

      const savedRecord = await res.json();

      if (formData.mediaFile) {
        await uploadMediaToSupabase(savedRecord.id, formData.mediaFile);
      }

      setFeedback({
        error: '',
        success: `Announcement ${isEditing ? 'updated' : 'published'} successfully!`,
      });
      setIsFormModalOpen(false);
      fetchAnnouncements();
    } catch (err) {
      console.error(err);
      setFeedback({ error: err.message || 'Operation failed.', success: '' });
    } finally {
      setSubmitting(false);
    }
  };

  // Delete Announcement
  const handleDelete = async () => {
    if (!selectedAnnouncement) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API_BASE}/api/announcements/admin/${selectedAnnouncement.id}/`, {
        method: 'DELETE',
        headers: getAuthHeaders(false),
      });

      if (!res.ok) throw new Error('Failed to delete announcement record.');

      setFeedback({ error: '', success: 'Announcement deleted successfully.' });
      setIsDeleteModalOpen(false);
      setIsDetailModalOpen(false);
      setSelectedAnnouncement(null);
      fetchAnnouncements();
    } catch (err) {
      setFeedback({ error: 'Failed to delete record.', success: '' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-[#f3f4f6] p-6 lg:p-10 font-sans text-gray-800">
        
        {/* Feedback Banners */}
        {feedback.error && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle size={18} /> {feedback.error}
          </div>
        )}
        {feedback.success && (
          <div className="mb-4 bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm">
            <CheckCircle size={18} /> {feedback.success}
          </div>
        )}

        {/* Action Toolbar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Search announcement, keyword, or brgy..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-xs font-medium text-gray-700 placeholder-gray-400 focus:outline-none focus:border-[#b32d2d] shadow-sm"
            />
          </div>

          <button
            onClick={() => handleOpenForm()}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#b32d2d] hover:bg-[#962626] text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Plus size={16} /> Post Announcement
          </button>
        </div>

        {/* Directory Card / Table */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          
          <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Megaphone className="text-[#b32d2d]" size={20} />
              <h2 className="text-base font-bold text-gray-800 tracking-tight">
                Public Announcements Directory
              </h2>
            </div>
            <span className="text-xs font-medium text-gray-400">
              {filteredAnnouncements.length} Enrolled Bulletins
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-3.5 px-6">ID</th>
                  <th className="py-3.5 px-6">ANNOUNCEMENT DETAILS</th>
                  <th className="py-3.5 px-6">ASSIGNED BARANGAY</th>
                  <th className="py-3.5 px-6">ATTACHMENT</th>
                  <th className="py-3.5 px-6">DATE PUBLISHED</th>
                  <th className="py-3.5 px-6 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-xs text-gray-600">
                {loading ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-gray-400">
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
                    <tr key={item.id} className="hover:bg-gray-50/75 transition-colors">
                      <td className="py-4 px-6 font-semibold text-gray-400">
                        #{item.id}
                      </td>

                      <td className="py-4 px-6 max-w-sm">
                        <div className="font-bold text-gray-800 text-sm">{item.title}</div>
                        <div className="text-gray-400 text-xs line-clamp-1 mt-0.5">
                          {item.content}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        <span className="flex items-center gap-1.5 text-gray-600 font-medium">
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
                          <span className="text-gray-300 text-[11px] font-medium">—</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-gray-500">
                        {item.created_at ? new Date(item.created_at).toLocaleDateString() : 'N/A'}
                      </td>

                      <td className="py-4 px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenDetail(item)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold transition-all"
                          >
                            <Eye size={13} />
                            VIEW FILE
                          </button>
                          <button
                            onClick={() => handleOpenForm(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-[11px] font-bold transition-all"
                            title="Edit"
                          >
                            <Edit3 size={13} />
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

        {/* Modal: View Announcement Details */}
        {isDetailModalOpen && selectedAnnouncement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-gray-900">
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

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      handleOpenForm(selectedAnnouncement);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => {
                      setIsDetailModalOpen(false);
                      setIsDeleteModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-50 hover:bg-red-100 text-[#b32d2d] transition-colors"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => setIsDetailModalOpen(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-gray-100 hover:bg-gray-200 text-gray-600 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-5 text-xs text-gray-600 max-h-[75vh] overflow-y-auto">
                <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-100 grid grid-cols-2 gap-4">
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
                      <video src={activeVideoUrl} controls className="max-h-80 w-full object-contain" />
                    </div>
                  ) : selectedAnnouncement.image_url ? (
                    <div className="rounded-xl overflow-hidden border border-gray-200 bg-black/5 flex items-center justify-center max-h-80">
                      <img src={selectedAnnouncement.image_url} alt="Attachment" className="max-h-80 w-full object-contain" />
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
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              
              <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
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

              <form onSubmit={handleSubmitForm} className="p-6 space-y-4 text-xs">
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
                    className="px-4 py-2 rounded-xl text-xs font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#b32d2d] hover:bg-[#962626] transition-all flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {submitting && <Loader2 className="animate-spin" size={14} />}
                    {selectedAnnouncement ? 'Update Announcement' : 'Broadcast Advisory'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Delete Confirmation */}
        {isDeleteModalOpen && selectedAnnouncement && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="bg-white max-w-sm w-full p-6 rounded-2xl shadow-xl text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 text-[#b32d2d] flex items-center justify-center mx-auto mb-3">
                <Trash2 size={22} />
              </div>
              <h4 className="text-base font-bold text-gray-900 mb-1">Delete Announcement</h4>
              <p className="text-xs text-gray-500 mb-5">
                Are you sure you want to remove <span className="font-semibold text-gray-800">"{selectedAnnouncement.title}"</span>? This action cannot be reversed.
              </p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 text-gray-600 font-bold text-xs hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={submitting}
                  className="px-4 py-2 rounded-xl bg-[#b32d2d] text-white font-bold text-xs hover:bg-[#962626] transition-all"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}