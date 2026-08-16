import { SimulatedDeviceDriver } from "@gzaccess/device-simulator";
import pino from "pino";

const logger = pino({
  name: "gzaccess-edge",
  level: process.env.LOG_LEVEL ?? "info",
});
const driver = new SimulatedDeviceDriver();

const health = await driver.getHealth();
logger.info(
  { device: driver.descriptor, health },
  "Edge base initialized with simulator driver",
);
