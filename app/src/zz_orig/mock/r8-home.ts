// The mock backend's round 8 calls for HOME (PROPOSED 19 Oct 2026): one question, one sheet (UX review WAY-3, LOAD-4).
// questions() lists what Fume still asks; answerQuestion() answers one in words or with a photo. The records live in
// questions.ts, which also spreads an answer to every place the same question shows (the product's line, the brief,
// the Brand understanding, the campaign's clock), so answering once closes it everywhere.

import type { FumeApi, FumeEvent, Id } from "../contract";
import { answerOne, listQuestions, type QuestionRecord } from "./questions";

type Db = Parameters<typeof listQuestions>[1];

export interface R8HomeContext {
  db: Db;
  questions: QuestionRecord[];
  wait: <T>(value: T) => Promise<T>;
  now: () => string;
  userId: () => Id;
  workspaceId: () => Id;
  emit: (event: FumeEvent) => void;
}

export function r8HomeApi(ctx: R8HomeContext): Pick<FumeApi, "questions" | "answerQuestion"> {
  const { db, questions, wait } = ctx;
  return {
    async questions() {
      return wait(listQuestions(questions, db, ctx.workspaceId()));
    },
    async answerQuestion(input) {
      answerOne(questions, db, { now: ctx.now, userId: ctx.userId, emit: ctx.emit }, ctx.workspaceId(), input);
      return wait(listQuestions(questions, db, ctx.workspaceId()));
    },
  };
}
