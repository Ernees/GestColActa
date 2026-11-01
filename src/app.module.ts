import { Module } from '@nestjs/common';
import { ActasModule } from './actas/actas.module';
import { AppConfigModule } from './config/app-config.module';

@Module({ imports: [AppConfigModule, ActasModule] })
export class AppModule {}
