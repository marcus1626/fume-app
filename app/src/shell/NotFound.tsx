// A route that does not exist, or a screen that threw. One line on what happened and the way home.
import { Button } from "@fume/ui";
import { isRouteErrorResponse, Link, useRouteError } from "react-router-dom";
import { Nothing, Page } from "./Page";

export function NotFound() {
  // null on the catch-all route itself; set only when a screen threw or the router answered.
  const error = useRouteError();
  const crashed = error != null && !(isRouteErrorResponse(error) && error.status === 404);
  if (crashed) console.error(error);
  return (
    <Page title={crashed ? "Something went wrong" : "Not found"} width="reading">
      <Nothing
        icon={crashed ? "circle-alert" : "search"}
        title={crashed ? "Something went wrong on this page" : "This page isn’t here"}
        text={crashed ? "Your work is safe. Go home and try again; if it happens again, tell Fume." : "The link may be old, or the campaign was moved."}
        action={
          <Button asChild variant="secondary" icon="house">
            <Link to="/">Go home</Link>
          </Button>
        }
      />
    </Page>
  );
}
