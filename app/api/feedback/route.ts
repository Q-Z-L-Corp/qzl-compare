import { NextRequest, NextResponse } from "next/server";

async function submitToGitHub(
  title: string,
  description: string,
  email?: string,
) {
  const pat = process.env.GITHUB_PAT;
  const issueUrl = process.env.GITHUB_ISSUES_URL;

  if (!pat || !issueUrl) {
    throw new Error("GitHub configuration missing");
  }

  const labels = ["feedback"];
  if (email && email.trim()) {
    labels.push(email.trim().toLowerCase());
  }

  const response = await fetch(issueUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: title.trim(),
      body: description.trim(),
      labels,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    console.error("GitHub API error:", error);
    throw new Error("Failed to submit feedback to GitHub");
  }

  return response.json();
}

export async function POST(req: NextRequest) {
  try {
    const { title, description, email } = await req.json();

    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    if (
      !description ||
      typeof description !== "string" ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "Description is required" },
        { status: 400 },
      );
    }

    if (email && typeof email === "string" && email.trim().length > 0) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email.trim())) {
        return NextResponse.json(
          { error: "Invalid email address" },
          { status: 400 },
        );
      }
    }

    const issue = await submitToGitHub(title, description, email);

    return NextResponse.json({
      success: true,
      message: "Thank you for your feedback!",
      issueUrl: issue.html_url,
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
