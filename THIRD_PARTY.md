# Third-Party Dependencies and Libraries

This document lists all libraries, frameworks, and third-party modules utilized by the CIT Campus Scheduling and Venue Management platform across backend and frontend stacks.

---

## 1. Backend (Python 3.11 / 3.13)

| Library | Version / Spec | Purpose & Category |
|---|---|---|
| **FastAPI** | `>=0.115.0` | Asynchronous high-performance REST API web framework |
| **Uvicorn** | `[standard] >=0.30.0` | ASGI web server implementation |
| **SQLAlchemy** | `>=2.0.0` | Object Relational Mapper (ORM) supporting SQLite and MySQL 8 |
| **PyMySQL** | `>=1.1.0` | Pure-Python MySQL client for MySQL 8 connectivity |
| **Pydantic** | `>=2.7.0` | Data validation, settings management, and strict schema enforcement |
| **Google OR-Tools** | `>=9.10.0` | CP-SAT solver for timetable generation, exam scheduling, booking optimization, and disruption repair |
| **python-jose[cryptography]** | `>=3.3.0` | JSON Web Token (JWT) encoding, decoding, and signature verification |
| **passlib[bcrypt]** / **bcrypt** | `>=1.7.4 / >=4.0.0` | Password hashing for secure user authentication |
| **python-multipart** | `>=0.0.9` | Multipart form data parsing for dataset and disruption uploads |

> **Note on Authentication & Security**: No third-party AI or LLM is involved in authentication, authorization, role derivation, or permission decisions. All credential verification and permission scoping are performed deterministically via `passlib[bcrypt]`, `python-jose`, and FastAPI dependencies.
| **python-dotenv** | `>=1.0.0` | Loading environment configurations from `.env` |
| **google-genai** | `>=0.1.0` | Official client library for Google Gemini API |
| **httpx** | `>=0.27.0` | Asynchronous HTTP client for API and background calls |
| **pytest** | `>=8.0.0` | Unit, integration, and rule-verification test framework |

---

## 2. Frontend (Node.js & React)

| Library | Purpose & Category |
|---|---|
| **React** / **React DOM** | UI library with TypeScript |
| **Vite** | Fast frontend build tool and dev server |
| **Tailwind CSS** | Utility-first CSS framework adhering to the Baseline design tokens |
| **Lucide React** | Clean, accessible SVG iconography |
| **React Router DOM** | Client-side routing and URL state management |
| **Axios** | HTTP client for backend REST API communication |
| **TanStack React Query** | Asynchronous server-state caching, background revalidation, and polling |
| **React Hook Form** | Performant, flexible form validation and management |
| **Zod** | TypeScript-first schema declaration and validation library |
| **Recharts** | Declarative charting library for room utilization and clash analytics |
| **clsx** & **tailwind-merge** | Class name utility concatenation for Tailwind components |

