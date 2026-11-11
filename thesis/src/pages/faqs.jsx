import React, { useState, useMemo } from 'react';
import { HelpCircle, Search, ChevronDown } from 'lucide-react';

import AdminLayout from '../components/header';

// Each FAQ: { category, q, a, list? }  ->  `list` renders as bullet points under the answer.
const FAQS = [
  /* ------------------------------- GENERAL ------------------------------- */
  {
    category: 'General',
    q: 'How do I load the latest data on a page?',
    a: 'Every page loads its data when you open it. Use the Refresh button on the page whenever you want to pull the newest records from the server. To keep the pages fast, the last loaded data is kept in your browser for the current session.'
  },
  {
    category: 'General',
    q: 'Why was I asked to log in again?',
    a: 'Your session expires after a while, or becomes invalid if your account is changed or signed out elsewhere. Just log in again; nothing you already saved is lost.'
  },
  {
    category: 'General',
    q: 'Which reports can I see?',
    a: 'Reports and potential duplicates are limited to the barangay assigned to your admin account. Reports from other barangays are not shown.'
  },

  /* ------------------------------- REPORTS ------------------------------- */
  {
    category: 'Reports',
    q: 'What do the report statuses mean?',
    a: 'Every report is in exactly one of these statuses:',
    list: [
      'Pending – submitted by a resident and not yet handled.',
      'Ongoing – a response is under way.',
      'Resolved – the incident was handled and the report is closed.',
      'Dismissed – the report was rejected (for example, it is invalid). A reason is required.'
    ]
  },
  {
    category: 'Reports',
    q: 'How do I change the status of a report?',
    a: 'Use the Status dropdown in the Incident Reports table, or the dropdown inside the report window. You will be asked to confirm, and the resident who submitted the report is notified of the new status.'
  },
  {
    category: 'Reports',
    q: 'Why do I have to pick a reason when dismissing a report?',
    a: 'A dismissal reason is required so there is always a record of why the report was rejected. The resident receives a notification that matches the reason you choose. If the report is later moved to another status, the dismissal reason and dismissal date are cleared.'
  },
  {
    category: 'Reports',
    q: 'What do Created At, Ongoing At, Resolved At and Dismissed At show?',
    a: 'They are the times each stage happened. Created At is when the resident submitted the report. Ongoing At, Resolved At and Dismissed At are recorded automatically the first time the report reaches that status. A dash (—) means it has not happened.'
  },
  {
    category: 'Reports',
    q: 'How is the nearest responder chosen?',
    a: 'Only active emergency units are considered, and the closest one by straight-line distance wins. The unit type depends on the incident category:',
    list: [
      'Road Accident – hospital or police',
      'Fire – fire station',
      'Medical Emergency – hospital',
      'Public Safety Incident – police',
      'Flooding, Infrastructure Hazard and Other – the nearest active unit of any type'
    ]
  },
  {
    category: 'Reports',
    q: 'Where can I find the resident who submitted a report?',
    a: 'Open the report and look at the Resident Details card. It shows the resident’s name, username, email, contact number and barangay. A resident from another barangay can still submit a report to your barangay.'
  },

  /* ------------------------------ DUPLICATES ----------------------------- */
  {
    category: 'Duplicates',
    q: 'How are potential duplicates detected?',
    a: 'When a report is submitted, it is compared with earlier reports. The match score combines how close the two locations are, how far apart in time they were submitted, whether they are in the same barangay, and how similar the descriptions are. Pairs that look alike appear in the Pending tab.'
  },
  {
    category: 'Duplicates',
    q: 'What do “Mark Duplicate” and “Dismiss” do?',
    a: 'Mark Duplicate confirms that the later report repeats the earlier one: the later report is marked Resolved and its owner is notified. Dismiss means the two reports are different incidents, so both stay exactly as they are.'
  },
  {
    category: 'Duplicates',
    q: 'Why are some pairs already Dismissed?',
    a: 'When a report is moved to Ongoing or Resolved, its unresolved duplicate flags are dismissed automatically. You can find them in the Reviewed tab, where you can still Reopen them or mark them as a duplicate.'
  },
  {
    category: 'Duplicates',
    q: 'Why does the candidate duplicate show the same status as the main report?',
    a: 'The duplicate follows the status of the main (earlier) report, so if the main report is Resolved, the duplicate is shown as Resolved too.'
  },

  /* ------------------------------- RESIDENTS ----------------------------- */
  {
    category: 'Residents',
    q: 'How do I suspend a resident?',
    a: 'In Registered Residents, click Suspend on the resident’s row (or open the Resident Profile and use Suspend Resident). A reason is required: choose a reason and a detail, or choose Other and write a description. You will be asked to confirm before the suspension is applied.'
  },
  {
    category: 'Residents',
    q: 'What happens to a suspended resident?',
    a: 'The resident is signed out, cannot log in, and receives a notification with the reason. Their reports stay in the system. The reason is shown in their Resident Profile.'
  },
  {
    category: 'Residents',
    q: 'How do I re-activate a resident?',
    a: 'Click Re-activate on the resident’s row or in their profile and confirm. The suspension reason is cleared, the resident is notified, and they can log in again.'
  },

  /* ------------------------------- ANALYTICS ----------------------------- */
  {
    category: 'Analytics',
    q: 'How do I view a different time period?',
    a: 'Use the date filter on the Report Trends card. You can pick This Week, Today, Past Month, Past Year, All Time, or Custom Date Range. For a custom range, click the start date (From) first, then the end date (To). The dates being shown appear under the Report Trends title.'
  },
  {
    category: 'Analytics',
    q: 'What are DBSCAN clusters and noise?',
    a: 'DBSCAN groups reports that happened close together into hotspots: reports within 500 meters of each other, with at least 2 reports in a group. Reports that do not belong to any group are called noise. The map opens centered on the middle of your barangay; click a cluster to zoom to it and see its coordinates.'
  },
  {
    category: 'Analytics',
    q: 'Why is DBSCAN not shown automatically?',
    a: 'DBSCAN runs only when you click Run DBSCAN (or Re-run DBSCAN), so the page stays fast. Run it again whenever you want the hotspots updated with the newest reports.'
  },
  {
    category: 'Analytics',
    q: 'How do I download the PDF report?',
    a: 'Click Download PDF on the Analytics page. Page 1 contains the analytics, and page 2 contains the DBSCAN cluster map and summary. If DBSCAN has not been run yet, it runs automatically first, so the download can take a few seconds.'
  },

  /* ----------------------------- ANNOUNCEMENTS --------------------------- */
  {
    category: 'Announcements',
    q: 'How do I post an announcement?',
    a: 'Click Post Announcement, enter a title and the content, optionally attach an image or video, and confirm. Accepted files are JPG, PNG, WEBP, MP4 and MOV.'
  },
  {
    category: 'Announcements',
    q: 'Can I edit or delete an announcement after posting?',
    a: 'Yes. Click the announcement in the list, then choose Edit or Delete. Both ask for confirmation, and a deleted announcement cannot be restored.'
  }
];

const CATEGORIES = ['All', ...Array.from(new Set(FAQS.map((f) => f.category)))];

export default function FaqsPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [openIds, setOpenIds] = useState([]); // indexes (in FAQS) of the expanded questions

  const visibleFaqs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return FAQS.map((faq, id) => ({ ...faq, id })).filter((faq) => {
      if (category !== 'All' && faq.category !== category) return false;
      if (!q) return true;
      return (
        faq.q.toLowerCase().includes(q) ||
        faq.a.toLowerCase().includes(q) ||
        (faq.list || []).some((item) => item.toLowerCase().includes(q))
      );
    });
  }, [searchQuery, category]);

  const toggle = (id) =>
    setOpenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  return (
    <AdminLayout>
      <div className="p-4 sm:p-6 lg:p-8 h-full overflow-y-auto bg-[#f0f0f0] flex flex-col">

        {/* PAGE HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-5 shrink-0">
          <div className="flex items-center gap-3">
            <HelpCircle className="text-[#b32d2d]" size={24} />
            <h1 className="font-black text-xl sm:text-2xl text-gray-900">Frequently Asked Questions</h1>
          </div>
          <span className="text-xs sm:text-sm text-gray-900 font-black">
            {visibleFaqs.length} {visibleFaqs.length === 1 ? 'Question' : 'Questions'}
          </span>
        </div>

        {/* CONTROLS */}
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-2.5 mb-6 shrink-0">
          <div className="relative bg-white border border-gray-300 rounded-lg flex items-center shadow-xs w-full sm:w-72 lg:w-80 overflow-hidden">
            <Search size={18} className="text-gray-400 ml-3 shrink-0" />
            <input
              type="text"
              placeholder="Search questions or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full py-2 px-3 text-xs font-medium text-gray-700 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border shadow-xs ${
                  category === cat
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* QUESTIONS */}
        {visibleFaqs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 shadow-xs p-12 text-center text-gray-400 font-medium text-sm">
            No questions matched your search.
          </div>
        ) : (
          <div className="space-y-3">
            {visibleFaqs.map((faq) => {
              const isOpen = openIds.includes(faq.id);
              return (
                <div
                  key={faq.id}
                  className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(faq.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer hover:bg-gray-50/80 transition-colors"
                  >
                    <div className="min-w-0">
                      <span className="text-[10px] font-black uppercase tracking-wider text-[#b32d2d] block mb-0.5">
                        {faq.category}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{faq.q}</span>
                    </div>
                    <ChevronDown
                      size={18}
                      className={`text-gray-400 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                    />
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-5 pt-1 border-t border-gray-100 text-xs sm:text-[13px] text-gray-600 font-medium leading-relaxed">
                      <p className="mt-3">{faq.a}</p>
                      {faq.list && (
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                          {faq.list.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

      </div>
    </AdminLayout>
  );
}