// Register one repository per module (import { container } from 'tsyringe'):
//   container.registerSingleton<I<Module>Repository>(<MODULE>_REPOSITORY, <Module>Repository);
// Controllers and use cases are not registered: tsyringe resolves them by class.

// @template:example:start
import { container } from 'tsyringe';
import { ExampleRepository } from '@modules/example/repositories/example.repository';
import { IExampleRepository } from '@modules/example/repositories/iexample.repository';
import { EXAMPLE_REPOSITORY } from '@modules/example/repositories/example.tokens';
container.registerSingleton<IExampleRepository>(EXAMPLE_REPOSITORY, ExampleRepository);
// @template:example:end
