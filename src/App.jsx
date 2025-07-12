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
  Loader2,
  RefreshCw,
  ImageIcon,
  X,
  ArrowLeft,
  ArrowRight,
  FileText,
  Download,
  ExternalLink,
  Eye,
  Linkedin,
} from "lucide-react"
import { supabase } from "./lib/supabase"
import fergussonLogo from "./assets/fergusson-logo.jfif"
import * as XLSX from "xlsx" 

function App() {
  const [selectedYear, setSelectedYear] = useState("")
  const [selectedCompany, setSelectedCompany] = useState("")
  const [darkMode, setDarkMode] = useState(false)
  const [years, setYears] = useState([])
  const [companies, setCompanies] = useState([])
  const [placedStudents, setPlacedStudents] = useState([])
  const [placementPhotos, setPlacementPhotos] = useState([])
  const [interviewDoc, setInterviewDoc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showPhotoDialog, setShowPhotoDialog] = useState(false)
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0)

  const currentYear = new Date().getFullYear()

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme")
    const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

    if (savedTheme === "dark" || (!savedTheme && systemPrefersDark)) {
      setDarkMode(true)
      document.documentElement.classList.add("dark")
    }
  }, [])

  useEffect(() => {
    fetchYears()
  }, [])

  useEffect(() => {
    if (selectedYear) {
      fetchCompanies(selectedYear)
    } else {
      setCompanies([])
    }
    setSelectedCompany("")
    setPlacedStudents([])
    setPlacementPhotos([])
    setInterviewDoc(null)
  }, [selectedYear])

  useEffect(() => {
    if (selectedYear && selectedCompany) {
      fetchCompanyDetails(selectedYear, selectedCompany)
    } else {
      setPlacedStudents([])
      setPlacementPhotos([])
      setInterviewDoc(null)
    }
  }, [selectedYear, selectedCompany])

  const fetchYears = async () => {
    try {
      setLoading(true)
      setError(null)

      const { data: placementYears, error: placementError } = await supabase.from("placements").select("placement_year")

      const { data: interviewYears, error: interviewError } = await supabase.from("interview_questions").select("year")

      if (placementError) throw placementError
      if (interviewError) throw interviewError

      const allYears = [
        ...(placementYears || []).map((item) => String(item.placement_year)),
        ...(interviewYears || []).map((item) => String(item.year)),
      ]
      const uniqueYears = [...new Set(allYears)].sort((a, b) => b - a)
      setYears(uniqueYears)
    } catch (error) {
      console.error("Error fetching years:", error)
      setError("Failed to load years from database")
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

      const { data: placedCompanyIds, error: placedError } = await supabase
        .from("placements")
        .select("company_id")
        .eq("placement_year", year)

      const { data: interviewCompanyIds, error: interviewError } = await supabase
        .from("interview_questions")
        .select("company_id")
        .eq("year", year)

      if (placedError) throw placedError
      if (interviewError) throw interviewError

      const allCompanyIds = [
        ...(placedCompanyIds || []).map((item) => item.company_id),
        ...(interviewCompanyIds || []).map((item) => item.company_id),
      ]
      const uniqueCompanyIds = [...new Set(allCompanyIds)]

      if (uniqueCompanyIds.length === 0) {
        setCompanies([])
        return
      }

      const { data: companyNames, error: namesError } = await supabase
        .from("companies")
        .select("name")
        .in("id", uniqueCompanyIds)
        .order("name", { ascending: true })

      if (namesError) throw namesError

      setCompanies(companyNames.map((item) => item.name))
    } catch (error) {
      console.error("Error fetching companies:", error)
      setError("Failed to load companies")
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  const fetchCompanyDetails = async (year, companyName) => {
    setLoading(true)
    setError(null)
    setPlacedStudents([])
    setPlacementPhotos([])
    setInterviewDoc(null)

    try {
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("id")
        .eq("name", companyName)
        .single()

      if (companyError || !companyData) {
        throw new Error("Company not found or error fetching company ID.")
      }
      const companyId = companyData.id

      const { data: studentsData, error: studentsError } = await supabase
        .from("placements")
        .select("*, students(full_name, branch, graduation_year, linkedin_url)")
        .eq("placement_year", year)
        .eq("company_id", companyId)

      if (studentsError) throw studentsError
      setPlacedStudents(studentsData.map((p) => p.students))

      const { data: photosData, error: photosError } = await supabase
        .from("placement_photos")
        .select("*")
        .eq("year", year)
        .eq("company_id", companyId)

      if (photosError) throw photosError
      setPlacementPhotos(photosData)

      const { data: interviewData, error: interviewError } = await supabase
        .from("interview_questions")
        .select("*")
        .eq("year", year)
        .eq("company_id", companyId)
        .single()

      if (interviewError && interviewError.code !== "PGRST116") {
        throw interviewError
      }
      setInterviewDoc(interviewData)

      if (studentsData.length === 0 && photosData.length === 0 && !interviewData) {
        setError("No data found for this selection.")
      }
    } catch (err) {
      console.error("Error fetching company details:", err)
      setError(err.message || "Failed to load details.")
      setPlacedStudents([])
      setPlacementPhotos([])
      setInterviewDoc(null)
    } finally {
      setLoading(false)
    }
  }

  const downloadPlacementData = async (type = "company") => {
    try {
      let studentsToDownload = []
      let filename = ""
      let headers = []

      if (type === "company" && selectedYear && selectedCompany) {
        studentsToDownload = placedStudents
        filename = `${selectedCompany}_${selectedYear}_placements.xlsx`
        headers = ["Full Name", "Branch", "Graduation Year", "LinkedIn URL"]
      } else if (type === "year" && selectedYear) {
        const { data: yearData, error } = await supabase
          .from("placements")
          .select("*, students(full_name, branch, graduation_year, linkedin_url), companies(name)")
          .eq("placement_year", selectedYear)

        if (error) throw error
        studentsToDownload = yearData.map((p) => ({
          ...p.students,
          company_name: p.companies.name,
        }))
        filename = `All_Companies_${selectedYear}_placements.xlsx`
        headers = ["Full Name", "Branch", "Graduation Year", "Company", "LinkedIn URL"]
      }

      if (studentsToDownload.length === 0) {
        alert("No data to download")
        return
      }

      const dataForSheet = studentsToDownload.map((student) => {
        if (type === "year") {
          return [
            student.full_name,
            student.branch || "",
            student.graduation_year || "",
            student.company_name || "",
            student.linkedin_url || "",
          ]
        } else {
          return [student.full_name, student.branch || "", student.graduation_year || "", student.linkedin_url || ""]
        }
      })

      // Add headers to the beginning of the data array
      dataForSheet.unshift(headers)

      const ws = XLSX.utils.aoa_to_sheet(dataForSheet)

      // Calculate column widths
      const colWidths = headers.map((header, colIndex) => {
        const maxLength = Math.max(
          header.length,
          ...dataForSheet.slice(1).map((row) => (row[colIndex] ? String(row[colIndex]).length : 0)),
        )
        return { wch: maxLength + 2 } // Add some padding
      })
      ws["!cols"] = colWidths

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Placements")

      XLSX.writeFile(wb, filename)

      await supabase.from("document_analytics").insert([
        {
          action_type: `download_${type}_placements_excel`,
          timestamp: new Date().toISOString(),
        },
      ])
    } catch (error) {
      console.error("Error downloading placement data:", error)
      alert("Failed to download data")
    }
  }

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
    setPlacedStudents([])
    setPlacementPhotos([])
    setInterviewDoc(null)
    setError(null)
  }

  const openPhotoDialog = (index) => {
    setCurrentPhotoIndex(index)
    setShowPhotoDialog(true)
  }

  const closePhotoDialog = () => {
    setShowPhotoDialog(false)
    setCurrentPhotoIndex(0)
  }

  const nextPhoto = () => {
    setCurrentPhotoIndex((prevIndex) => (prevIndex + 1) % placementPhotos.length)
  }

  const prevPhoto = () => {
    setCurrentPhotoIndex((prevIndex) => (prevIndex - 1 + placementPhotos.length) % placementPhotos.length)
  }

  const handleDownloadInterviewDoc = async (docId, link) => {
    try {
      await supabase.from("document_analytics").insert([
        {
          document_id: docId,
          action_type: "download_interview_questions",
          timestamp: new Date().toISOString(),
        },
      ])
      window.open(link, "_blank")
    } catch (error) {
      console.error("Error tracking download:", error)
      window.open(link, "_blank")
    }
  }

  const getEmbedUrl = (docUrl) => {
    if (!docUrl) return ""
    const match = docUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)
    if (match) {
      const docId = match[1]
      return `https://docs.google.com/document/d/${docId}/preview`
    }
    return docUrl
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-indigo-900 transition-all duration-500">
      <header className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm border-b border-gray-200 dark:border-gray-700 transition-all duration-300">
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
                  Fergusson College Placements & Interview Questions
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-300 transition-colors duration-200">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">For Students, By Students</span>
              </div>

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

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center mb-4">
            <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400 mr-2 animate-pulse" />
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white transition-colors duration-200">
              Explore Placements & Interview Questions
            </h2>
          </div>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto transition-colors duration-200 animate-slide-up">
            Discover which students got placed where, view memorable moments, and access interview questions shared by
            your fellow students.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-12">
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
                <button
                  onClick={() => downloadPlacementData("year")}
                  className="mt-2 flex items-center space-x-1 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors duration-200"
                >
                  <Download className="h-3 w-3" />
                  <span>Download all {selectedYear} placements (Excel)</span>
                </button>
              </div>
            )}
          </div>

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
                {placedStudents.length > 0 && (
                  <button
                    onClick={() => downloadPlacementData("company")}
                    className="mt-2 flex items-center space-x-1 text-xs text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors duration-200"
                  >
                    <Download className="h-3 w-3" />
                    <span>Download {selectedCompany} placements (Excel)</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {selectedYear && selectedCompany && (
          <div className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-xl shadow-lg hover:shadow-xl p-8 border border-gray-200 dark:border-gray-700 transition-all duration-300 animate-scale-in">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-200">
                  {selectedCompany} - {selectedYear} Details
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mt-1 transition-colors duration-200">
                  Interview questions, placements, and photos
                </p>
              </div>
              <button
                onClick={resetSelections}
                className="px-4 py-2 text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all duration-200 transform hover:scale-105"
              >
                Change Selection
              </button>
            </div>

            {loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
                <span className="ml-2 text-gray-600 dark:text-gray-300">Loading data...</span>
              </div>
            )}

            {error && !loading && (
              <div className="border-2 border-dashed border-red-300 dark:border-red-600 rounded-lg p-12 text-center">
                <div className="max-w-md mx-auto">
                  <BookOpen className="h-12 w-12 text-red-400 dark:text-red-500 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">{error}</h4>
                  <p className="text-red-600 dark:text-red-300">
                    No data found for {selectedCompany} in {selectedYear}.
                  </p>
                </div>
              </div>
            )}

            {!loading && !error && (placedStudents.length > 0 || placementPhotos.length > 0 || interviewDoc) && (
              <div className="space-y-8">
                {interviewDoc && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Interview Questions</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Access Google Docs with comprehensive interview questions
                        </p>
                      </div>
                      <button
                        onClick={() => handleDownloadInterviewDoc(interviewDoc.id, interviewDoc.questions_link)}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105"
                      >
                        <Download className="h-4 w-4" />
                        <span>Download Doc</span>
                      </button>
                    </div>
                    <div className="relative">
                      <div className="block md:hidden">
                        <div className="w-full h-64 flex items-center justify-center bg-gray-100 dark:bg-gray-700">
                          <div className="text-center p-6">
                            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-300 mb-4">
                              Document preview is not available on mobile devices.
                            </p>
                            <button
                              onClick={() => window.open(interviewDoc.questions_link, "_blank")}
                              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200"
                            >
                              <ExternalLink className="h-4 w-4" />
                              <span>Open Document</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="hidden md:block">
                        <iframe
                          src={getEmbedUrl(interviewDoc.questions_link)}
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
                              onClick={() => window.open(interviewDoc.questions_link, "_blank")}
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
                )}

                {placedStudents.length > 0 && (
                  <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-indigo-200 dark:border-indigo-700 animate-fade-in">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <Users className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
                        <h4 className="text-xl font-bold text-gray-900 dark:text-white">Placed Students</h4>
                      </div>
                      <button
                        onClick={() => downloadPlacementData("company")}
                        className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg transition-all duration-200 transform hover:scale-105"
                      >
                        <Download className="h-4 w-4" />
                        <span>Export Excel</span>
                      </button>
                    </div>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {placedStudents.map((student, index) => (
                        <li
                          key={index}
                          className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-600 transition-all duration-200 hover:shadow-md"
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900 dark:text-white">{student.full_name}</p>
                              <p className="text-sm text-gray-600 dark:text-gray-300">{student.branch}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Graduation: {student.graduation_year}
                              </p>
                            </div>
                            {student.linkedin_url && (
                              <a
                                href={student.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-2 p-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 transition-colors duration-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-full"
                                aria-label={`${student.full_name}'s LinkedIn profile`}
                              >
                                <Linkedin className="h-5 w-5" />
                              </a>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {placementPhotos.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in">
                    <div className="p-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600 flex justify-between items-center">
                      <div>
                        <h5 className="text-lg font-semibold text-gray-900 dark:text-white">Placement Photos</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-300">Memories from the placement drive</p>
                      </div>
                      <button
                        onClick={() => openPhotoDialog(0)}
                        className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-all duration-200 transform hover:scale-105"
                      >
                        <ImageIcon className="h-4 w-4" />
                        <span>View Photos ({placementPhotos.length})</span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 p-4">
                      {placementPhotos.slice(0, 4).map((photo, index) => (
                        <div
                          key={photo.id}
                          className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-200"
                          onClick={() => openPhotoDialog(index)}
                        >
                          <img
                            src={photo.photo_url || "/placeholder.svg"}
                            alt={photo.caption || `Placement photo ${index + 1}`}
                            className="w-full h-32 sm:h-40 object-cover transition-transform duration-300 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                            <Eye className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      ))}
                      {placementPhotos.length > 4 && (
                        <div
                          className="relative group cursor-pointer overflow-hidden rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                          onClick={() => openPhotoDialog(4)}
                        >
                          <span className="text-xl font-bold">+{placementPhotos.length - 4} More</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {placedStudents.length === 0 && placementPhotos.length === 0 && !interviewDoc && !loading && !error && (
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-12 text-center transition-all duration-300 hover:border-indigo-300 dark:hover:border-indigo-500">
                    <div className="max-w-md mx-auto">
                      <BookOpen className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4 animate-bounce transition-colors duration-200" />
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 transition-colors duration-200">
                        No Data Available Yet
                      </h4>
                      <p className="text-gray-600 dark:text-gray-300 transition-colors duration-200">
                        No placement data, photos, or interview questions found for {selectedCompany} in {selectedYear}.
                        Check back later or contribute your own!
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

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

      {showPhotoDialog && placementPhotos.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-3xl w-full mx-4 p-6">
            <button
              onClick={closePhotoDialog}
              className="absolute top-4 right-4 p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200"
              aria-label="Close dialog"
            >
              <X className="h-6 w-6" />
            </button>
            <div className="text-center mb-4">
              <h3 className="text-2xl font-bold text-gray-900 dark:text-white">Placement Photos</h3>
              <p className="text-gray-600 dark:text-gray-300">
                {currentPhotoIndex + 1} of {placementPhotos.length}
              </p>
            </div>
            <div className="relative flex items-center justify-center">
              <button
                onClick={prevPhoto}
                disabled={placementPhotos.length <= 1}
                className="absolute left-2 p-2 rounded-full bg-gray-200/70 dark:bg-gray-700/70 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous photo"
              >
                <ArrowLeft className="h-6 w-6" />
              </button>
              <img
                src={placementPhotos[currentPhotoIndex].photo_url || "/placeholder.svg"}
                alt={placementPhotos[currentPhotoIndex].caption || "Placement photo"}
                className="max-h-[70vh] w-auto object-contain rounded-lg shadow-lg"
              />
              <button
                onClick={nextPhoto}
                disabled={placementPhotos.length <= 1}
                className="absolute right-2 p-2 rounded-full bg-gray-200/70 dark:bg-gray-700/70 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next photo"
              >
                <ArrowRight className="h-6 w-6" />
              </button>
            </div>
            {placementPhotos[currentPhotoIndex].caption && (
              <p className="text-center text-gray-700 dark:text-gray-300 mt-4">
                {placementPhotos[currentPhotoIndex].caption}
              </p>
            )}
          </div>
        </div>
      )}

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
