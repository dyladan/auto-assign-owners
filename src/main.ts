import * as core from "@actions/core";
import * as github from "@actions/github";
import { getChangedFiles, getConfig, getOwners, getPullAuthor, getRefs, getCollaboratorLogins } from "./utils";

// this is an owned file

async function main() {
    const client = github.getOctokit(core.getInput('repo-token', { required: true }));
    const ownerFilePath = core.getInput('config-file', { required: true });

    const { base, head } = getRefs();

    const config = await getConfig(client, head, ownerFilePath);

    const changedFiles = await getChangedFiles(client, base, head);
    const owners = await getOwners(config, changedFiles);

 
    core.info(`${owners.length} owners found ${owners.join(" ")}`);

    let nonCollaborators = false;
    const collaborators = await getCollaboratorLogins(client);
    const author = await getPullAuthor(client);

    const reviewers = []
    for (const owner of owners) {
        if (owner === author) continue;

        if (!collaborators.has(owner)) {
            nonCollaborators = true;
            continue;
        }
        reviewers.push(owner);
    }

    if (reviewers.length > 0) {
        core.info("Adding reviewers");
        const requestReviewersResult = await client.rest.pulls.requestReviewers({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: github.context.issue.number,
            reviewers,
        });
        core.debug(JSON.stringify(requestReviewersResult));
    }

    if (nonCollaborators) {
        core.setFailed(
            `Reviews may only be requested from collaborators. One or more of the users or teams you specified is not a collaborator of the ${github.context.repo.owner}/${github.context.repo.repo} repository.`
        )
    }
}

main().catch(err => {
    core.debug(err.toString());
    core.setFailed(err.message);
});
