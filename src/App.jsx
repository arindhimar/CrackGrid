"use client"

import { useState, useEffect } from "react"
import {
  ChevronDown,
  BookOpen,
  Users,
  Calendar,
  Sun,
  Moon,
  Sparkles,
  ExternalLink,
  FileText,
  Loader2,
  RefreshCw,
} from "lucide-react"
import { supabase } from "./lib/supabase"
import fergussonLogo from "./assets/fergusson-logo.jfif"

function App() {
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [darkMode, setDarkMode] = useState(false)
  const [years, setYears] = useState([])
  const [companies, setCompanies] = useState([])
  const [currentDoc, setCurrentDoc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const currentYear = new Date().getFullYear()

  // Initialize theme from localStorage or system preference
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      setDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  // Fetch available years from Supabase
  useEffect(() => {
    fetchYears()
  }, [])

  // Fetch companies when year changes
  useEffect(() => {
    if (selectedYear) {
      fetchCompanies(selectedYear)
    } else {
      setCompanies([])
    }
    setSelectedCompany("")
    setCurrentDoc(null)
  }, [selectedYear])

  // Fetch document when both year and company are selected
  useEffect(() => {
    if (selectedYear && selectedCompany) {
      fetchDocument(selectedYear, selectedCompany)
    } else {
      setCurrentDoc(null)
    }
  }, [selectedYear, selectedCompany])

  // Supabase API Functions
  const fetchYears = async () => {
    try {
      setLoading(true)
      setError(null)

      console.log("Fetching years from crackgriddb...")
      const { data, error } = await supabase.from("documents").select("year").order("year", { ascending: false })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      console.log("Years data:", data)
      // Get unique years
      const uniqueYears = [...new Set(data.map((item) => item.year))]
      setYears(uniqueYears)
    } catch (error) {
      console.error("Error fetching years:", error)
      setError("Failed to load years from database")
      // Fallback to current and previous years if database is empty
      const fallbackYears = Array.from({ length: 5 }, (_, i) => String(currentYear - i))
      setYears(fallbackYears)
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanies = async (year) => {
    try {
      setLoading(true)
      setError(null)

      console.log(`Fetching companies for year ${year}...`)
      const { data, error } = await supabase
        .from("documents")
        .select("company_name")
        .eq("year", year)
        .order("company_name", { ascending: true })

      if (error) {
        console.error("Supabase error:", error)
        throw error
      }

      console.log("Companies data:", data)
      // Get unique companies for the selected year
      const uniqueCompanies = [...new Set(data.map((item) => item.company_name))]
      setCompanies(uniqueCompanies)
    } catch (error) {
      console.error("Error fetching companies:", error)
      setError("Failed to load companies")
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const fetchDocument = async (year, company) => {
    try {
      setLoading(true)
      setError(null)

      console.log(`Fetching document for ${company} - ${year}...`)
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("year", year)
        .eq("company_name", company)
        .single()

      if (error) {
        if (error.code === "PGRST116") {
          // No rows returned
          setCurrentDoc(null)
          setError("No document found for this selection")
        } else {
          console.error("Supabase error:", error)
          throw error
        }
      } else {
        console.log("Document data:", data)
        setCurrentDoc(data)
      }
    } catch (error) {
      console.error("Error fetching document:", error)
      setError("Error loading document")
      setCurrentDoc(null)
    } finally {
      setLoading(false)
    }
  }

  // Toggle theme
  const toggleTheme = () => {
    const newDarkMode = !darkMode
    setDarkMode(newDarkMode)

    if (newDarkMode) {
      document.documentElement.classList.add("dark")
      localStorage.setItem("theme", "dark")
    } else {
      document.documentElement.classList.remove("dark")
      localStorage.setItem("theme", "light")
    }
  }

  const resetSelections = () => {
    setSelectedYear("")
    setSelectedCompany("")
    setCurrentDoc(null)
    setError(null)
  }

  const handleDownload = async (documentId, companyName, year) => {
    try {
      // Track download in Supabase (optional)
      await supabase.from("document_analytics").insert([
        {
          document_id: documentId,
          action_type: "download",
          timestamp: new Date().toISOString(),
        },
      ])

      // Open download URL
      if (currentDoc?.questions_link) {
        window.open(currentDoc.questions_link, "_blank")
      }
    } catch (error) {
      console.error("Error tracking download:", error)
      // Still allow download even if tracking fails
      if (currentDoc?.questions_link) {
        window.open(currentDoc.questions_link, "_blank")
      }
    }
  }

  const handleViewDoc = async (docUrl) => {
    try {
      // Track view in Supabase (optional)
      if (currentDoc?.id) {
        await supabase.from("document_analytics").insert([
          {
            document_id: currentDoc.id,
            action_type: "view",
            timestamp: new Date().toISOString(),
          },
        ])
      }

      window.open(docUrl, "_blank")
    } catch (error) {
      console.error("Error tracking view:", error)
      // Still allow view even if tracking fails
      window.open(docUrl, "_blank")
    }
  }

  // Convert Google Docs URL to embeddable format
  const getEmbedUrl = (docUrl) => {
    if (!docUrl) return ""

    // Extract document ID from Google Docs URL
    const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) {
      const docId = match[1]
      return `https://docs.google.com/document/d/${docId}/preview`
    }
    return docUrl
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-900 transition-all duration-500">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 transition-all duration-300">
        {/* Keep all header content the same */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3 group">
              <div className="bg-white p-2 rounded-lg transform group-hover:scale-110 transition-transform duration-200 shadow-md">
                <img
                  src={fergussonLogo || "/placeholder.svg"}
                  alt="Fergusson College Pune"
                  className="h-8 w-8 object-contain"
                />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-200">
                  CrackGrid
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                  Fergusson College Interview Questions
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">For Students, By Students</span>
              </div>

              {/* Refresh Button */}
              <button
                onClick={() => {
                  fetchYears()
                  if (selectedYear) fetchCompanies(selectedYear)
                }}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
                aria-label="Refresh data"
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 text-gray-600 dark:text-gray-300 ${loading ? "animate-spin" : ""}`} />
              </button>

              {/* Theme Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
                aria-label="Toggle theme"
              >
                {darkMode ? (
                  <Sun className="h-5 w-5 text-yellow-500 animate-pulse" />
                ) : (
                  <Moon className="h-5 w-5 text-indigo-600" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - flex-1 makes it take up remaining space */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Welcome Section */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mr-2 animate-pulse" />
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white transition-colors duration-200">
              Find Interview Questions by Year & Company
            </h2>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto transition-colors duration-200 animate-slide-up">
            Access Google Docs with comprehensive interview questions shared by your fellow students. Preview documents
            directly and download complete files.
          </p>
        </div>

        {/* Selection Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-12">
          {/* Year Selection */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl p-6 border border-gray-200 dark:border-gray-700 transition-all duration-300 transform hover:-translate-y-1 animate-slide-in-left">
            <div className="flex items-center space-x-3 mb-4">
              <Calendar className="h-6 w-6 text-indigo-600 dark:text-indigo-400 transition-colors duration-200" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
                Select Year
              </h3>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />}
            </div>
            <div className="relative">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                disabled={loading}
                className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 appearance-none cursor-pointer transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-500 disabled:opacity-50"
              >
                <option value="">Choose a year...</option>
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none transition-colors duration-200" />
            </div>
            {selectedYear && (
              <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg animate-fade-in border border-indigo-200 dark:border-indigo-700">
                <p className="text-sm text-indigo-700 dark:text-indigo-300 transition-colors duration-200">
                  ✓ Selected: <span className="font-semibold">{selectedYear}</span>
                </p>
              </div>
            )}
          </div>

          {/* Company Selection */}
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl p-6 border border-gray-200 dark:border-gray-700 transition-all duration-300 transform hover:-translate-y-1 animate-slide-in-right">
            <div className="flex items-center space-x-3 mb-4">
              <div className="h-6 w-6 bg-gradient-to-r from-indigo-600 to-purple-600 rounded flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
                <span className="text-white text-xs font-bold">C</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white transition-colors duration-200">
                Select Company
              </h3>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-indigo-600 dark:text-indigo-400" />}
            </div>
            <div className="relative">
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                disabled={!selectedYear || loading}
                className={`w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-indigo-500 dark:focus:border-indigo-400 appearance-none cursor-pointer transition-all duration-200 hover:border-indigo-300 dark:hover:border-indigo-500 ${
                  !selectedYear || loading ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <option value="">{selectedYear ? "Choose a company..." : "Select a year first"}</option>
                {companies.map((company) => (
                  <option key={company} value={company}>
                    {company}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 dark:text-gray-500 pointer-events-none transition-colors duration-200" />
            </div>
            {selectedCompany && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg animate-fade-in border border-green-200 dark:border-green-700">
                <p className="text-sm text-green-700 dark:text-green-300 transition-colors duration-200">
                  ✓ Selected: <span className="font-semibold">{selectedCompany}</span>
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {selectedYear && selectedCompany && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl p-8 border border-gray-200 dark:border-gray-700 transition-all duration-300 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-200">
                  {selectedCompany} - {selectedYear}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mt-1 transition-colors duration-200">
                  Interview questions and experiences
                </p>
              </div>
              <button
                onClick={resetSelections}
                className="px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Change Selection
              </button>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-300">Loading document...</span>
              </div>
            )}

            {/* Error State */}
            {error && !loading && (
              <div className="border-2 border-dashed border-red-300 dark:border-red-600 rounded-lg p-12 text-center">
                <div className="max-w-md mx-auto">
                  <BookOpen className="h-12 w-12 text-red-400 dark:text-red-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">{error}</h4>
                  <p className="text-red-600 dark:text-red-300">
                    Questions for {selectedCompany} in {selectedYear} haven't been uploaded yet.
                  </p>
                </div>
              </div>
            )}

            {/* Document Content */}
            {currentDoc && !loading && !error && (
              <div className="space-y-6">
                {/* Document Header */}
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-700">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                      <div>
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                          {currentDoc.title || `${selectedCompany} Interview Questions`}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Updated {new Date(currentDoc.updated_at || currentDoc.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleDownload(currentDoc.id, selectedCompany, selectedYear)}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Download</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Document Preview */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                    <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Document Preview</h5>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      Preview of the Google Doc • Click "Download" to get the full document
                    </p>
                  </div>
                  <div className="relative">
                    {/* Mobile View - Show message instead of iframe */}
                    <div className="block md:hidden">
                      <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                        <div className="text-center p-6">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-300 mb-4">
                            Document preview is not available on mobile devices.
                          </p>
                          <button
                            onClick={() => window.open(currentDoc.questions_link, "_blank")}
                            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span>Open Document</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Desktop View - Show iframe */}
                    <div className="hidden md:block">
                      <iframe
                        src={getEmbedUrl(currentDoc.questions_link)}
                        className="w-full h-96 border-0"
                        title={`${selectedCompany} ${selectedYear} Interview Questions`}
                        loading="lazy"
                        onError={(e) => {
                          console.error("Error loading iframe:", e)
                          e.target.style.display = "none"
                          e.target.nextSibling.style.display = "block"
                        }}
                      />
                      <div
                        className="hidden w-full h-96 flex items-center justify-center bg-gray-100 dark:bg-gray-700"
                        style={{ display: "none" }}
                      >
                        <div className="text-center">
                          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-600 dark:text-gray-300 mb-4">Preview not available.</p>
                          <button
                            onClick={() => window.open(currentDoc.questions_link, "_blank")}
                            className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200"
                          >
                            <ExternalLink className="h-4 w-4" />
                            <span>Open Document</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* No Document Available */}
            {!currentDoc && !loading && !error && (
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center transition-all duration-300 hover:border-indigo-300 dark:hover:border-indigo-500">
                <div className="max-w-md mx-auto">
                  <BookOpen className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4 animate-bounce transition-colors duration-200" />
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors duration-200">
                    No Questions Available Yet
                  </h4>
                  <p className="text-gray-600 dark:text-gray-300 transition-colors duration-200">
                    Questions for {selectedCompany} in {selectedYear} haven't been uploaded yet. Check back later or
                    contribute your own!
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Stats Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:-translate-y-1 animate-slide-up border border-gray-200 dark:border-gray-700">
            <div className="text-3xl font-bold text-indigo-600 dark:text-indigo-400 mb-2 transition-colors duration-200">
              {years.length}+
            </div>
            <div className="text-gray-600 dark:text-gray-300 transition-colors duration-200">Years of Data</div>
          </div>
          <div
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:-translate-y-1 animate-slide-up border border-gray-200 dark:border-gray-700"
            style={{ animationDelay: "0.1s" }}
          >
            <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2 transition-colors duration-200">
              {selectedYear ? companies.length : "?"}
            </div>
            <div className="text-gray-600 dark:text-gray-300 transition-colors duration-200">
              {selectedYear ? `Companies in ${selectedYear}` : "Companies Available"}
            </div>
          </div>
          <div
            className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-lg shadow hover:shadow-lg p-6 text-center transition-all duration-300 transform hover:-translate-y-1 animate-slide-up border border-gray-200 dark:border-gray-700"
            style={{ animationDelay: "0.2s" }}
          >
            <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2 transition-colors duration-200">
              ∞
            </div>
            <div className="text-gray-600 dark:text-gray-300 transition-colors duration-200">Student Success</div>
          </div>
        </div>
      </main>

      {/* Footer - will stick to bottom */}
      <footer className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-t border-gray-200 dark:border-gray-700 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600 dark:text-gray-300 transition-colors duration-200">
            <p>&copy; {currentYear} CrackGrid - Fergusson College Pune. Made with ❤️ by students, for students.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
