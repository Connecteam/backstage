## API Report File for "@backstage/plugin-kubernetes-cluster"

> Do not edit this file. It is a report generated by [API Extractor](https://api-extractor.com/).

```ts
/// <reference types="react" />

import { Entity } from '@backstage/catalog-model';
import { default as React_2 } from 'react';

// @public
export const EntityKubernetesClusterContent: (
  props: EntityKubernetesClusterContentProps,
) => JSX.Element;

// @public
export type EntityKubernetesClusterContentProps = {};

// @public (undocumented)
export const isKubernetesClusterAvailable: (entity: Entity) => boolean;

// @public (undocumented)
export const Router: () => React_2.JSX.Element;

// Warnings were encountered during analysis:
//
// src/Router.d.ts:8:22 - (ae-undocumented) Missing documentation for "isKubernetesClusterAvailable".
// src/Router.d.ts:14:22 - (ae-undocumented) Missing documentation for "Router".
```