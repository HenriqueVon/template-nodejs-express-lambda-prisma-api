export type OpenApiTag = {
  name: string;
  description?: string;
};

// One tag per module, the plural title of the resource. Every tag must be used by an operation.
export const openApiTags: OpenApiTag[] = [
  // @template:example:start
  {
    name        : 'Examples',
    description : 'Reference module of the template: a complete CRUD to copy when adding a module.',
  },
  // @template:example:end
];
