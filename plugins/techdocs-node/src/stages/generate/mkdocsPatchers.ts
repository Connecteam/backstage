/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { Logger } from 'winston';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { ParsedLocationAnnotation } from '../../helpers';
import { getRepoUrlFromLocationAnnotation, MKDOCS_SCHEMA } from './helpers';
import { assertError } from '@backstage/errors';
import { ScmIntegrationRegistry } from '@backstage/integration';

type MkDocsObject = {
  plugins?: string[];
  docs_dir: string;
  repo_url?: string;
  edit_uri?: string;
};

const patchMkdocsFile = async (
  mkdocsYmlPath: string,
  logger: Logger,
  updateAction: (mkdocsYml: MkDocsObject) => boolean,
) => {
  // We only want to override the mkdocs.yml if it has actually changed. This is relevant if
  // used with a 'dir' location on the file system as this would permanently update the file.
  let didEdit = false;

  let mkdocsYmlFileString;
  try {
    mkdocsYmlFileString = await fs.readFile(mkdocsYmlPath, 'utf8');
  } catch (error) {
    assertError(error);
    logger.warn(
      `Could not read MkDocs YAML config file ${mkdocsYmlPath} before running the generator: ${error.message}`,
    );
    return;
  }

  let mkdocsYml: any;
  try {
    mkdocsYml = yaml.load(mkdocsYmlFileString, { schema: MKDOCS_SCHEMA });

    // mkdocsYml should be an object type after successful parsing.
    // But based on its type definition, it can also be a string or undefined, which we don't want.
    if (typeof mkdocsYml === 'string' || typeof mkdocsYml === 'undefined') {
      throw new Error('Bad YAML format.');
    }
  } catch (error) {
    assertError(error);
    logger.warn(
      `Error in parsing YAML at ${mkdocsYmlPath} before running the generator. ${error.message}`,
    );
    return;
  }

  didEdit = updateAction(mkdocsYml);

  try {
    if (didEdit) {
      await fs.writeFile(
        mkdocsYmlPath,
        yaml.dump(mkdocsYml, { schema: MKDOCS_SCHEMA }),
        'utf8',
      );
    }
  } catch (error) {
    assertError(error);
    logger.warn(
      `Could not write to ${mkdocsYmlPath} after updating it before running the generator. ${error.message}`,
    );
    return;
  }
};

/**
 * Update the mkdocs.yml file before TechDocs generator uses it to generate docs site.
 *
 * List of tasks:
 * - Add repo_url or edit_uri if it does not exists
 * If mkdocs.yml has a repo_url, the generated docs site gets an Edit button on the pages by default.
 * If repo_url is missing in mkdocs.yml, we will use techdocs annotation of the entity to possibly get
 * the repository URL.
 *
 * This function will not throw an error since this is not critical to the whole TechDocs pipeline.
 * Instead it will log warnings if there are any errors in reading, parsing or writing YAML.
 *
 * @param mkdocsYmlPath - Absolute path to mkdocs.yml or equivalent of a docs site
 * @param logger - A logger instance
 * @param parsedLocationAnnotation - Object with location url and type
 * @param scmIntegrations - the scmIntegration to do url transformations
 */
export const patchMkdocsYmlPreBuild = async (
  mkdocsYmlPath: string,
  logger: Logger,
  parsedLocationAnnotation: ParsedLocationAnnotation,
  scmIntegrations: ScmIntegrationRegistry,
) => {
  await patchMkdocsFile(mkdocsYmlPath, logger, mkdocsYml => {
    if (!('repo_url' in mkdocsYml) || !('edit_uri' in mkdocsYml)) {
      // Add edit_uri and/or repo_url to mkdocs.yml if it is missing.
      // This will enable the Page edit button generated by MkDocs.
      // If the either has been set, keep the original value
      const result = getRepoUrlFromLocationAnnotation(
        parsedLocationAnnotation,
        scmIntegrations,
        mkdocsYml.docs_dir,
      );

      if (result.repo_url || result.edit_uri) {
        mkdocsYml.repo_url = mkdocsYml.repo_url || result.repo_url;
        mkdocsYml.edit_uri = mkdocsYml.edit_uri || result.edit_uri;

        logger.info(
          `Set ${JSON.stringify(
            result,
          )}. You can disable this feature by manually setting 'repo_url' or 'edit_uri' according to the MkDocs documentation at https://www.mkdocs.org/user-guide/configuration/#repo_url`,
        );
        return true;
      }
    }
    return false;
  });
};

/**
 * Update the mkdocs.yml file before TechDocs generator uses it to generate docs site.
 *
 * List of tasks:
 * - Add all provided default plugins
 *
 * This function will not throw an error since this is not critical to the whole TechDocs pipeline.
 * Instead it will log warnings if there are any errors in reading, parsing or writing YAML.
 *
 * @param mkdocsYmlPath - Absolute path to mkdocs.yml or equivalent of a docs site
 * @param logger - A logger instance
 * @param defaultPlugins - List of default mkdocs plugins
 */
export const patchMkdocsYmlWithPlugins = async (
  mkdocsYmlPath: string,
  logger: Logger,
  defaultPlugins: string[] = ['techdocs-core'],
) => {
  await patchMkdocsFile(mkdocsYmlPath, logger, mkdocsYml => {
    // Modify mkdocs.yaml to contain the required default plugins.
    // If no plugins are defined we can just return the defaults.
    if (!('plugins' in mkdocsYml)) {
      mkdocsYml.plugins = defaultPlugins;
      return true;
    }

    // Otherwise, check each default plugin and include it if necessary.
    let changesMade = false;

    defaultPlugins.forEach(dp => {
      // if the plugin isn't there as a string, and isn't there as an object (which may itself contain extra config)
      // then we need to add it
      if (
        !(
          mkdocsYml.plugins!.includes(dp) ||
          mkdocsYml.plugins!.some(p => p.hasOwnProperty(dp))
        )
      ) {
        mkdocsYml.plugins = [...new Set([...mkdocsYml.plugins!, dp])];
        changesMade = true;
      }
    });

    return changesMade;
  });
};
