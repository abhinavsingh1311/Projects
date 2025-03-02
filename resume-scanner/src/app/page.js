'use client';
import { userResumes } from '../server/middleware/hooks/useResumes';

export default function Home() {
  const { resumes, loading, error } = userResumes();
  if (loading)
    return (
      <div>
        loading resumes....
      </div>
    )
  if (error)
    return (
      <div>Error: {error}</div>
    )
  return (

    <div>
      <h1>Resumes:</h1>
      {resumes.length === 0} ? (
      <p>No resumes found.Upload your resume first</p>
      ):
      (
      <ul>
        {resumes.map(resume => {
          <li key={resume.id}>
            <h3>{resume.title}</h3>
            <p>status:{resume.status}</p>
            <a href={resume.file_url} target="_blank" rel="noopener noreferrer">
              View Resume
            </a>
          </li>
        })}
      </ul>
      )

    </div>


  );
}
