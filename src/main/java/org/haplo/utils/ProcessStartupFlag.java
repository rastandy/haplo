/* Haplo Platform                                     http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

package org.haplo.utils;

import java.io.File;

import org.apache.log4j.Logger;

public class ProcessStartupFlag {
    public static void processIsReady() {
        Logger logger = Logger.getLogger("org.haplo.app");

        String startupFlagFilename = System.getProperty("org.haplo.startupflag", "");
        if(startupFlagFilename.length() == 0) {
            logger.info("No startup flag file specified, won't do anything.");
        } else {
            logger.info("Startup flag file: " + startupFlagFilename);
            File file = new File(startupFlagFilename);
            if(file.exists()) {
                file.delete();
                logger.info("Deleted startup flag file.");
            } else {
                logger.info("Startup flag file doesn't exist, won't do anything.");
            }
        }
    }
}
