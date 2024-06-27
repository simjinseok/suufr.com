"use client";
import { format } from "date-fns/format";

import React from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { Heading } from "@/components/heading";
import { useParams } from "next/navigation";
import { Divider } from "@/components/divider";
import { Button } from "@/components/button";
import FeedbackForm from "@/components/feedback-form";

const NewLessonDialog = dynamic(() => import("./_new-lesson-dialog"));
const EditDialog = dynamic(() => import("./_edit-lesson-dialog"));
export default function Lessons({ lessons }) {
  const router = useRouter();

  const [openFeedback, setOpenFeedback] = React.useState(null);
  const [openNewLesson, setOpenNewLesson] = React.useState(false);
  const [editLesson, setEditLesson] = React.useState<any>(null);

  return (
    <div className="mt-8">
      <div className="flex items-end justify-between">
        <Heading level={2}>일정 관리</Heading>
        <Button color="emerald" onClick={setOpenNewLesson.bind(null, true)}>
          일정 추가
        </Button>
      </div>
      <Divider className="my-3" />
      {openNewLesson && (
        <NewLessonDialog onClose={setOpenNewLesson.bind(null, false)} />
      )}
      {Array.isArray(lessons) && lessons.length > 0 ? (
        <ul className="divide-y">
          {lessons.map((lesson) => (
            <li
              key={`lesson-${lesson.id}`}
              className="flex py-3 justify-between"
            >
              <div>
                <p className="font-mono">
                  {format(new Date(lesson.lessonAt), "yyyy-MM-dd")}
                </p>
                <p>{lesson.notes}</p>
              </div>
              <div>
                <Button onClick={setOpenFeedback.bind(null, lesson)}>
                  피드백
                </Button>
              </div>
              <div>
                <button
                  type="button"
                  onClick={setEditLesson.bind(null, lesson)}
                >
                  수정
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div>일정이 없습니다.</div>
      )}

      {openFeedback && (
        <FeedbackForm
          lesson={openFeedback}
          isOpen={openFeedback}
          onSuccess={() => {
            router.refresh();
            setOpenFeedback(null);
          }}
          onClose={setOpenFeedback.bind(null, null)}
        />
      )}
      {editLesson && (
        <EditDialog lesson={editLesson} onClose={() => setEditLesson(null)} />
      )}
    </div>
  );
}
