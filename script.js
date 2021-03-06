var http        = require('http')
var fs          = require('fs') 
var Canvas      = require('canvas');
var	query       = require('cli-interact').getYesNo;
var cliProgress = require('cli-progress');

var noiseThreshold = 225; // bigger = more light becomes black (default ~225)
var extraWhitespace = 10; // half of it on each side
var holeThreshold = 2     // max hole size in pixel to bridge 
var sizeThreshold = {     // smaller objects won't get saved   
    x : 0,
    y : 0
}

const progressBar = new cliProgress.SingleBar({
    format: '|{bar}| {percentage}% || {value}/{total} Chunkz || {duration_formatted} || ETA: {eta_formatted}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
});

function sortNumber(a, b) {
    return a - b;
}

function drawAt(ctx, pixeldata, location){

    offset = (pixeldata.width * location[1] + location[0]) * 4;
    pixeldata.data[offset] = 0;   // rot
    pixeldata.data[offset + 1] = 0; // grün
    pixeldata.data[offset + 2] = 255; // blau
    // pixeldata.data[offset + 3]; // Transparenz

    ctx.putImageData(pixeldata, 0, 0);
}

function determineNoiseThreshold(pixeldata) {

    console.log('Determing Noise Threshold..');

    var grayLevels = {};
    var pixels = 0;
    var total = 0;

    for (x = 0; x < pixeldata.width; x++) {
        for (y = 0; y < pixeldata.height; y++) {
           
            pixels++;

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            grayLevel = Math.round((r + g + b) / 3);

            if(!(grayLevel in grayLevels)){
                grayLevels[grayLevel] = 1;
            }else{
                grayLevels[grayLevel] += 1;
            }
        }
    }
    console.log(pixels);
    console.log((pixels/100*12.5));
    for(var x in grayLevels){
        if(total < (pixels/100*12.5)){
            total += grayLevels[x];
        }else{
            noiseThreshold = x;
            break;
        }
    }
    console.log(grayLevels);
    console.log('Noise Threshold set to', x);
}

function transparentToWhite(pixeldata) {
    for (x = 0; x < pixeldata.width; x++) {

        for (y = 0; y < pixeldata.height; y++) {

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            if(a == 0) {
                pixeldata.data[offset] = 255;
                pixeldata.data[offset + 1] = 255;
                pixeldata.data[offset + 2] = 255;
                pixeldata.data[offset + 3] = 255;
            }
        }
    }

    return pixeldata;
}

function filterNoise(pixeldata) {
    
    //console.log("Filtering Noise..");

    for(var x = 0; x < pixeldata.data.length; x+=4){
        if( pixeldata.data[x] < noiseThreshold) {
            pixeldata.data[x] = 0;
            pixeldata.data[x+1] = 0;
            pixeldata.data[x+2] = 0;
        }else if(pixeldata.data[x] >= noiseThreshold) {
            pixeldata.data[x] = 255;
            pixeldata.data[x+1] = 255;
            pixeldata.data[x+2] = 255;
        }
    }

    return pixeldata;
}

function move(direction, currentCoords){
    var currentX = currentCoords[0];
    var currentY = currentCoords[1];

    if(direction == 'right') currentX++;
    if(direction == 'down') currentY++;
    if(direction == 'left') currentX--;
    if(direction == 'up') currentY--;

    return [currentX, currentY];
}

function moveable(direction, currentCoords, pixeldata){
    var accessible = false;
    var currentX = currentCoords[0];
    var currentY = currentCoords[1];

    if(direction == 'right') currentX++;
    if(direction == 'down') currentY++;
    if(direction == 'left') currentX--;
    if(direction == 'up') currentY--;

    offset = (pixeldata.width * currentY + currentX) * 4;
    r = pixeldata.data[offset];   // rot

    if(r == 255) accessible = true;

    return accessible;
}

function getDirection(currentCoords, nextCoords) {

    if(currentCoords[0] == nextCoords[0] &&
        currentCoords[1] == nextCoords[1] + 1){
            return 'up';
    }else if(currentCoords[0] == nextCoords[0] &&
            currentCoords[1] == nextCoords[1] - 1){
            return 'down';
    }else if(currentCoords[0] == nextCoords[0] + 1 &&
            currentCoords[1] == nextCoords[1]){
            return 'left';
    }else if(currentCoords[0] == nextCoords[0] - 1 &&
            currentCoords[1] == nextCoords[1]){
            return 'right';
    }else{
        console.log('Error getting direction.');
    }
}

function checkForHoles(pixeldata, lastCoords, currentCoords, nextCoords) {

    return false;

    var edgePosition = null;
    // var direction = getDirection(lastCoords, currentCoords);
    var direction = getDirection(currentCoords, nextCoords);
    var edgeX = null;
    var edgeY = null;

    var goAhead = false;

    // check for pixel near to fill hole, going clockwise, spectating quarter-circle in direction counter clockwise to clockwise

    console.log('checking holes in direction', direction, 'current', currentCoords, 'next', nextCoords);

    for(var a = 0; a <= holeThreshold + 1; a++){
        for(var b = 0; b <= holeThreshold + 1; b++){
            
            offset = null;

            // Correct spectating ! but y always before x ..
            if(direction == 'up'){
                if(a == 0 && b >= 2 || a >= 1){
                    offset = (pixeldata.width * (nextCoords[1] - b) + (nextCoords[0] - a)) * 4;
                    // console.log('Specating', (nextCoords[1] - b), (nextCoords[0] - a));
                }

            }else if(direction == 'right'){
                if(a == 0 && b >= 1 || a == 1 && b >= 1 || a >= 2){
                    offset = (pixeldata.width * (nextCoords[1] - b) + (nextCoords[0] + a)) * 4;
                    // console.log('Specating', (nextCoords[1] - b), (nextCoords[0] + a));
                }
                
            }else if(direction == 'down'){
                if(a == 0 && b >= 2 || a >= 1){
                    offset = (pixeldata.width * (nextCoords[1] + b) + (nextCoords[0] + a)) * 4;
                    // console.log('Specating', (nextCoords[1] + b), (nextCoords[0] + a));
                }

            }else if(direction == 'left'){
                if(a == 0 && b >= 1 || a == 1 && b >= 1 || a >= 2){
                    offset = (pixeldata.width * (nextCoords[1] + b) + (nextCoords[0] - a)) * 4; 
                    // console.log('Specating', (nextCoords[1] + b), (nextCoords[0] - a));    
                }
            }

            if(offset !== null){
                r = pixeldata.data[offset];   // rot

                if(r == 0){
                    if(direction == 'up'){
                        edgeX = nextCoords[0] - a;
                        edgeY = nextCoords[1] - b;
                        if(edgeY == nextCoords[1]){

                            // console.log("true up");
                            nextStepOffset = (pixeldata.width * nextCoords[1] + nextCoords[0]) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log(nextCoords[0], nextCoords[1], 'COLORED BLACK');

                            query('hit', true);

                            return true
                        }else{

                            nextStepOffset = (pixeldata.width * nextCoords[1] + (nextCoords[0]+1)) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log((nextCoords[0]+1), nextCoords[1], 'COLORED BLACK');

                            goAhead = true;
                        }
                    }else if(direction == 'right'){
                        edgeX = nextCoords[0] + a;
                        edgeY = nextCoords[1] - b;

                        // console.log('nextcoords', nextCoords, 'edgecoords', edgeX, edgeY);
                        if(edgeX == nextCoords[0]){

                            // console.log("true right");
                            nextStepOffset = (pixeldata.width * nextCoords[1] + nextCoords[0]) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log(nextCoords[0], nextCoords[1], 'COLORED BLACK');

                            query('hit', true);

                            return true
                        }else{

                            nextStepOffset = (pixeldata.width * (nextCoords[1]+1) + nextCoords[0]) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log(nextCoords[0], (nextCoords[1]+1), 'COLORED BLACK');

                            goAhead = true;
                        }
                    }else if(direction == 'down'){
                        edgeX = nextCoords[0] + a;
                        edgeY = nextCoords[1] + b;
                        console.log(edgeX, edgeY, nextCoords[1]);
                        if(edgeY == nextCoords[1]){

                            // console.log("true down");
                            nextStepOffset = (pixeldata.width * nextCoords[1] + nextCoords[0]) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log(nextCoords[0], nextCoords[1], 'COLORED BLACK');
                            
                            query('hit', true);

                            return true
                        }else{

                            nextStepOffset = (pixeldata.width * nextCoords[1] + (nextCoords[0]-1)) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log((nextCoords[0]-1), nextCoords[1], 'COLORED BLACK');

                            goAhead = true;
                        }
                    }else if(direction == 'left'){
                        edgeX = nextCoords[0] - a;
                        edgeY = nextCoords[1] + b;
                        if(edgeX == nextCoords[0]){

                            // console.log("true left");
                            nextStepOffset = (pixeldata.width * nextCoords[1] + nextCoords[0]) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log(nextCoords[0], nextCoords[1], 'COLORED BLACK');
                            
                            query('hit', true);

                            return true;
                        }else{

                            nextStepOffset = (pixeldata.width * (nextCoords[1]-1) + nextCoords[0]) * 4;
                            pixeldata.data[nextStepOffset] = 0;
                            pixeldata.data[nextStepOffset+1] = 0;
                            pixeldata.data[nextStepOffset+2] = 0;

                            console.log(nextCoords[0], (nextCoords[1]-1), 'COLORED BLACK');

                            goAhead = true;
                        }
                    }
                }
            }
        }
    }

    // CONTINUE NEEDS TO MAKE CORNERS NOT 'DIAGONALS' 
    // FUCKS UP THE WHOLE SYSTEM

    if(goAhead){
        console.log('continue');

        return 'continue';
    }else{
        console.log("false");

        return false;
    }
}

function bridge(pixeldata, lastCoords, currentCoords, nextCoords){

    console.log('Trying to bridge');

    var olddirection = getDirection(lastCoords, currentCoords);
    var newdirection = getDirection(currentCoords, nextCoords);

    if(olddirection != newdirection){
        for(var a = 1; a <= holeThreshold; a++){

            switch(olddirection){
                case 'up':
                    offset = (pixeldata.width * (currentCoords[1]-a) + currentCoords[0]) * 4;
                    break;
                case 'right':
                    offset = (pixeldata.width * currentCoords[1] + (currentCoords[0]+a)) * 4;
                    break;
                case 'down':
                    offset = (pixeldata.width * (currentCoords[1]+a) + currentCoords[0]) * 4;
                    break;
                case 'left':
                    offset = (pixeldata.width * currentCoords[1] + (currentCoords[0]-a)) * 4;
                    break;
            }
            
            r = pixeldata.data[offset];   
            
            if(r == 0){
                return true;
            }
        }
    }

    return false;
}

function getBorders(pixeldata) {

    console.log("Getting borders..");

    progressBar.start((pixeldata.width*pixeldata.height), 0, {});

    var border = [];
    var borders = [];
    
    var currentCoords = [];
    var startCoords = [];
    var facing = 'right';

    var lastCoords = null;

    for (x = 0; x < pixeldata.width; x++) {

        for (y = 0; y < pixeldata.height; y++) {

            progressBar.increment();

            offset = (pixeldata.width * y + x) * 4;
            r = pixeldata.data[offset];   // rot
            g = pixeldata.data[offset + 1]; // grün
            b = pixeldata.data[offset + 2]; // blau
            a = pixeldata.data[offset + 3]; // Transparenz

            topOffset           = (pixeldata.width * (y-1) + x) * 4;
            rTop                = pixeldata.data[topOffset];

            topRightOffset      = (pixeldata.width * (y-1) + (x+1)) * 4;
            rTopRight           = pixeldata.data[topRightOffset];

            rightOffset         = (pixeldata.width * y + (x+1)) * 4;
            rRight              = pixeldata.data[rightOffset];

            bottomRightOffset   = (pixeldata.width * (y+1) + (x+1)) * 4;
            rBottomRight        = pixeldata.data[bottomRightOffset];

            bottomOffset        = (pixeldata.width * (y+1) + x) * 4;
            rBottom             = pixeldata.data[bottomOffset];

            bottomLeftOffset    = (pixeldata.width * (y+1) + (x-1)) * 4;
            rBottomLeft         = pixeldata.data[bottomLeftOffset];

            leftOffset          = (pixeldata.width * y + (x-1)) * 4;
            rLeft               = pixeldata.data[leftOffset];
            
            topLeftOffset       = (pixeldata.width * (y-1) + (x-1)) * 4;
            rTopLeft            = pixeldata.data[topLeftOffset];

            if(border.length == 0){
                // if( r == 255 && rTop == 255 &&
                //     r == 255 && rTopRight == 255 &&
                //     r == 255 && rRight == 255 &&
                //     r == 255 && rBottomRight == 0 &&
                //     r == 255 && rBottom == 255 && 
                //     r == 255 && rBottomLeft == 255 &&
                //     r == 255 && rLeft == 255 &&
                //     r == 255 && rTopLeft == 255){

                if( r == 255 && rBottomRight == 0 &&
                    r == 255 && rRight == 255){

                    if(JSON.stringify(borders).indexOf(JSON.stringify([x, y])) == -1){
                        currentCoords = [x, y];
                        startCoords = [x, y];
                        lastCoords = [x, y];
                        border.push([x, y]);
                    }else if(JSON.stringify(borders).indexOf(JSON.stringify([(x+1), y])) == -1){
                        currentCoords = [x, y];
                        startCoords = [x, y];
                        lastCoords = [x, y];
                        border.push([x, y]);
                    }else if(JSON.stringify(borders).indexOf(JSON.stringify([x, (y+1)])) == -1 && rBottom == 255){
                        currentCoords = [x, y];
                        startCoords = [x, y];
                        lastCoords = [x, y];
                        border.push([x, y]);
                    }
                }
            }

            while(border.length > 0){
                if(border.length == 1){


                    // switch(checkForHoles(pixeldata, lastCoords, currentCoords, move('right', currentCoords))){
                        
                    //     case true:
                    //         facing = 'up';
                    //         break;

                    //     case false:
                            currentCoords = move('right', currentCoords);
                            border.push(currentCoords);
                            facing = 'down';
                    //         break;

                    //     case 'continue':
                    //         currentCoords = move('right', currentCoords);
                    //         border.push(currentCoords);
                    //         break;
                    // }
                }else{
                    if(facing == 'up'){
                        if(moveable('up', currentCoords, pixeldata)){


                            // switch(checkForHoles(pixeldata, lastCoords, currentCoords, move('up', currentCoords))){
                        
                            //     case true:
                            //         facing = 'left';
                            //         break;
        
                            //     case false:
                                    lastCoords = [...currentCoords];

                                    currentCoords = move('up', currentCoords);
                                    border.push(currentCoords);
                                    facing = 'right';
                            //         break;
        
                            //     case 'continue':
                            //         lastCoords = [...currentCoords];

                            //         currentCoords = move('up', currentCoords);
                            //         border.push(currentCoords);
                            //         break;
                            // }
                        }else{
                            facing = 'left';
                        }
                    }else if(facing == 'right'){
                        if(moveable('right', currentCoords, pixeldata)){



                            // switch(checkForHoles(pixeldata, lastCoords, currentCoords, move('right', currentCoords))){
                        
                            //     case true:
                            //         facing = 'up';
                            //         break;
        
                            //     case false:
                                    lastCoords = [...currentCoords];

                                    currentCoords = move('right', currentCoords);
                                    border.push(currentCoords);
                                    facing = 'down';
                            //         break;
        
                            //     case 'continue':
                            //         lastCoords = [...currentCoords];

                            //         currentCoords = move('right', currentCoords);
                            //         border.push(currentCoords);
                            //         break;
                            // }
                        }else{
                            facing = 'up';
                        }
                    }else if(facing == 'down'){
                        if(moveable('down', currentCoords, pixeldata)){


                            // switch(checkForHoles(pixeldata, lastCoords, currentCoords, move('down', currentCoords))){
                        
                            //     case true:
                            //         // console.log('true.. facing right');
                            //         facing = 'right';
                            //         break;
        
                            //     case false:
                                    lastCoords = [...currentCoords];

                                    currentCoords = move('down', currentCoords);
                                    border.push(currentCoords);
                                    facing = 'left';
                            //         break;
        
                            //     case 'continue':
                            //         lastCoords = [...currentCoords];

                            //         currentCoords = move('down', currentCoords);
                            //         border.push(currentCoords);
                            //         break;
                            // }
                        }else{
                            facing = 'right';
                        }
                    }else if(facing == 'left'){
                        if(moveable('left', currentCoords, pixeldata)){



                            // switch(checkForHoles(pixeldata, lastCoords, currentCoords, move('left', currentCoords))){
                        
                            //     case true:
                            //         facing = 'down';
                            //         break;
        
                            //     case false:
                                    lastCoords = [...currentCoords];

                                    currentCoords = move('left', currentCoords);
                                    border.push(currentCoords);
                                    facing = 'up';
                            //         break;
        
                            //     case 'continue':
                            //         lastCoords = [...currentCoords];

                            //         currentCoords = move('left', currentCoords);
                            //         border.push(currentCoords);
                            //         break;
                            // }
                        }else{
                            facing = 'down';
                        }
                    }
                }

                if(JSON.stringify(currentCoords) == JSON.stringify(startCoords)){
                    if(border.length <= 4){
                        //console.log('Object too small - scraped')
                        border = [];
                    }else{    
                        //console.log('Object finished');
                        borders.push(border);
                        border = [];
                    }
                }
            }
        }
    }

    progressBar.stop();

    return borders;
}

function drawBorders(ctx, borders) {
    // Draw Line via Border Array

    console.log("Drawing borders..");

    ctx.lineWidth = 1;
    ctx.strokeStyle = 'red';
    ctx.beginPath();

    for(b = 0; b < borders.length; b++){
        for(var a = 0; a < borders[b].length; a++){

            // + 0.5 to get rid of blurry lines
            if(a == 0){
                ctx.moveTo(borders[b][a][0]+0.5, borders[b][a][1]);
            }else{
                ctx.lineTo(borders[b][a][0]+0.5, borders[b][a][1]);
            }

            if(a == borders[b].length-1){
                ctx.closePath();
            }
        }
    }

    ctx.stroke();
}

function saveBordersAsImages(img, borders) {

    console.log("Saving images via borders..");

    // Calculate x and y of borders down to the edge to get a small picture
    // And get the x and y width to limit canvas size
    for(l = 0; l < borders.length; l++){
        // Smallest & Biggest X, Y coordinate on original
        smallestX = undefined;
        smallestY = undefined;
        biggestX = undefined;
        biggestY = undefined;
        // New length & height
        xLength  = undefined;
        yHeight  = undefined;

        for(y = 0; y < 4; y++){
            for(x = 0; x < borders[l].length; x++){
                if(y == 0){
                    if(x == 0){
                        smallestX = borders[l][x][0];
                        biggestX = borders[l][x][0];
                    }else{
                        if(borders[l][x][0] < smallestX) smallestX = borders[l][x][0];
                        if(borders[l][x][0] > biggestX) biggestX = borders[l][x][0];
                    } 
                }else if(y == 1){
                    if(x == 0){
                        smallestY = borders[l][x][1];
                        biggestY = borders[l][x][1];
                    }else{
                        if(borders[l][x][1] < smallestY) smallestY = borders[l][x][1];
                        if(borders[l][x][1] > biggestY) biggestY = borders[l][x][1];
                    } 
                }else if(y == 2){
                    borders[l][x][0] -= smallestX;
                    if(x == 0){
                        xLength = borders[l][x][0];
                    }else{
                        if(borders[l][x][0] > xLength) xLength = borders[l][x][0];
                    } 
                }else if(y == 3){
                    borders[l][x][1] -= smallestY;
                    if(x == 0){
                        yHeight = borders[l][x][1];
                    }else{
                        if(borders[l][x][1] > yHeight) yHeight = borders[l][x][1];
                    } 
                }
            }
        }

        xDistance = biggestX - smallestX;
        yDistance = biggestY - smallestY;

        var canvas = Canvas.createCanvas(xDistance-1, yDistance-1);

        var ctx = canvas.getContext('2d');

        // Define Clipping Path of currently first border
        ctx.beginPath();
        ctx.moveTo(borders[l][0][0], borders[l][0][1]);
        for(var i = 1; i < borders[l].length; i++){
            var p = borders[l][i];
            ctx.lineTo(borders[l][i][0], borders[l][i][1]);
        }
        ctx.closePath();
        ctx.clip();

        // Draw original Image over canvas with clipping area defined
        ctx.drawImage(img, (smallestX-(extraWhitespace/2)), (smallestY-(extraWhitespace/2)), xDistance, yDistance, -1, -1, xDistance, yDistance)
    
        // Enable line below when passing canvas instead of img to this function. i.e. cropping processed image
        // ctx.drawImage(img, smallestX, smallestY, xDistance, yDistance, -1, -1, xDistance, yDistance)


        try{
            var pixeldata = ctx.getImageData(0, 0, img.width, img.height);
        }catch(e){
            console.log('Error while saving occured: ', e);
        }
        // filterNoise needed here to get rid of red borders (or disable drawing borders..)
        // currently not needed as we're cropping from the original image not the processed one (i.e. no drawn borders)
        // pixeldata = filterNoise(pixeldata);
        pixeldata = transparentToWhite(pixeldata);
        ctx.putImageData(pixeldata, 0, 0);

        // save image as file
        var file = canvas.toDataURL("image/png");

        var data = file.replace(/^data:image\/\w+;base64,/, "");
        var buf = new Buffer(data, 'base64');
        fs.writeFile('cropped/image'+ l + '.png', buf, (error) => { /* handle error */ });
    }

    console.log("Done.\n");
}

function expandBorders(pixeldata){

    var tmphits = {};
    var tmpArr = [];

    for (x = (extraWhitespace/2); x < pixeldata.width-(extraWhitespace/2); x++) {
        for (y = (extraWhitespace/2); y < pixeldata.height-(extraWhitespace/2); y++) {

            tmphits = {};

            coreOffset = (pixeldata.width * y + x) * 4;
            coreR = pixeldata.data[coreOffset];
            
            console.log();
            query('x: ' + x + ' y: ' + y + ' coreR: ' + coreR, true);

            if(coreR == 255){
                for(var a = 0; a < 4; a++){ // 0: up 1: right 2: down 3: left

                    var stretchAbort = false;
                    tmpArr = [];
                    

                    for(var t = 1; t <= holeThreshold+1; t++){
                        
                        //query('a: ' + a + ' t: ' + t, true);

                        switch(a){
                            case 0:

                                if(t <= y && !stretchAbort){

                                    offset = (pixeldata.width * (y-t) + x) * 4;
                                    r = pixeldata.data[offset];
                                
                                    console.log('UP: ', x, (y-t), r);
    
                                    if(r == 255){
                                        tmpArr.push([x, (y-t)]);
                                    }else if(r == 0){
                                        stretchAbort = true;
                                    }
                                }else{
                                    console.log('Abort')
                                }

                                break;
                            case 1:

                                if(t <= (pixeldata.width - x) && !stretchAbort){

                                    offset = (pixeldata.width * y + (x+t)) * 4;
                                    r = pixeldata.data[offset];

                                    console.log('RIGHT: ', (x+t), y, r);

                                    if(r == 255){
                                        tmpArr.push([(x+t), y]);
                                    }else if(r == 0){
                                        stretchAbort = true;
                                    }
                                }else{
                                    console.log('Abort');
                                }

                                break;
                            case 2:

                                if(t <= (pixeldata.height - y) && !stretchAbort){

                                    offset = (pixeldata.width * (y+t) + x) * 4;
                                    r = pixeldata.data[offset];

                                    console.log('DOWN: ', x, (y+t), r);

                                    if(r == 255){
                                        tmpArr.push([x, (y+t)]);
                                    }else if(r == 0){
                                        stretchAbort = true;
                                    }
                                }else{
                                    console.log('Abort');
                                }

                                break;
                            case 3:

                                if(t <= x && !stretchAbort){

                                    offset = (pixeldata.width * y + (x-t)) * 4;
                                    r = pixeldata.data[offset];

                                    console.log('LEFT: ', (x-t), y, r);

                                    if(r == 255){
                                        tmpArr.push([(x-t), y]);
                                    }else if(r == 0){
                                        stretchAbort = true;
                                    }
                                }else{
                                    console.log('Abort');
                                }

                                break;
                        }
                        
                        if(t == holeThreshold+1 && stretchAbort){
                            switch(a){
                                case 0:
                                    console.log('up +', tmpArr)
                                    tmphits['up'] = tmpArr;
                                    break;
                                case 1:
                                    tmphits['right'] = tmpArr;
                                    console.log('right +', tmpArr)
                                    break;
                                case 2:
                                    tmphits['down'] = tmpArr;
                                    console.log('down +', tmpArr)
                                    break;
                                case 3:
                                    tmphits['left'] = tmpArr;
                                    console.log('left +', tmpArr)
                                    break;
                            }
                        }
                        console.log('tmphits length: ',Object.keys(tmphits).length);
                        console.log(tmphits);
                        if(a == 3 && Object.keys(tmphits).length >= 2){

                            console.log('MATCH', tmphits);

                        }
                    }
                }
            }
        }
    }
}

function filterBorders(borders, pixeldata) {

    console.log("Filtering borders..");

    var smallX = null;
    var smallY = null;
    var bigX   = null;
    var bigY   = null;

    var coordValues = [];
    var indexToDelete = [];

    for(var a = 0; a < borders.length; a++){       
        for(var b = 0; b < borders[a].length; b++){
            if(b == 0){
                smallX = borders[a][b][0];
                bigX   = borders[a][b][0];
                smallY = borders[a][b][1];
                bigY   = borders[a][b][1];
            }else{
                if(borders[a][b][0] < smallX) smallX = borders[a][b][0];
                if(borders[a][b][0] > bigX) bigX = borders[a][b][0];
                if(borders[a][b][1] < smallY) smallY = borders[a][b][1];
                if(borders[a][b][1] > bigY) bigY = borders[a][b][1]; 
            }
        }    
        coordValues.push([smallX, smallY, bigX, bigY]);
    }

    // Marking object to delete before veryfing (if size threshold is not exceeded)
    // May be improveable (running time) - But don't delete coordValues, the positions are linked with the border positions
    for(var x = 0; x < coordValues.length; x++){
        if(coordValues[x][2] - coordValues[x][0] - 1 < sizeThreshold.x &&
            coordValues[x][3] - coordValues[x][1] - 1 < sizeThreshold.y){

                indexToDelete.push(x);
                //console.log('Object too small - ditching.');
        }
    }

    // Checking if Objects are indeed in another Object
    for(var a = 0; a < coordValues.length; a++){
        for(var b = a+1; b < coordValues.length; b++){
            
            if(coordValues[a][0] > coordValues[b][0] &&
                coordValues[a][1] > coordValues[b][1] &&
                coordValues[a][2] < coordValues[b][2] &&
                coordValues[a][3] < coordValues[b][3]) {
                    //console.log('a ' + a + ' in b' + b);
                    if(!verifyObjectInObject(coordValues[b], coordValues[a], b, a, borders, pixeldata)){
                        // console.log('Delete Flagging Index a', a);
                        if(!indexToDelete.includes(a)) indexToDelete.push(a);
                    }
            }else if(coordValues[a][0] < coordValues[b][0] &&
                coordValues[a][1] < coordValues[b][1] &&
                coordValues[a][2] > coordValues[b][2] &&
                coordValues[a][3] > coordValues[b][3]) {
                    //console.log('b ' + b + ' in a ' +  a);
                    if(!verifyObjectInObject(coordValues[a], coordValues[b], a, b, borders, pixeldata)){
                        // console.log('Delete Flagging Index b', b);
                        if(!indexToDelete.includes(b)) indexToDelete.push(b);
                    }
            }
        }
    }

    indexToDelete.sort(sortNumber);

    var counter = 0;

    for(var x = 0; x < indexToDelete.length; x++){
        borders.splice(indexToDelete[x]-counter, 1);
        counter++;
    }

    return borders;
}

function verifyObjectInObject(outerBB, innerBB, outerIndex, innerIndex, borders, pixeldata) {

    //console.log("Verifying that object is in another object..");
    var goalReached = false;
    var startPointReached = false;

    // var outerBorder = borders[outerIndex];
    var innerBorder = borders[innerIndex];

    var startPoint = innerBorder[0];
    var firstHit = false;
    var movePoint  = [...innerBorder[0]];

    // var moveSet = {
    //     0: left,
    //     1: down,
    //     2: right,
    //     3: up
    // }

    var moveSetCounter = 0;

    var colorOfObject = null;

    var tempCoords = {};

    var moved = false;
    // Get Color of inner Object to define exclude rule
    // Min X point, go one left, check color 
    // Also Max X Min Y and Max Y?
    for(a = 0; a < innerBorder.length; a++){        
        if(innerBorder[a][0] == innerBB[0] && (!('left' in tempCoords))){
            tempCoords['left'] = innerBorder[a];
        }
        if(innerBorder[a][1] == innerBB[1] && (!('top' in tempCoords))){
            tempCoords['top'] = innerBorder[a];
        }
        if(innerBorder[a][0] == innerBB[2] && (!('right' in tempCoords))){
            tempCoords['right'] = innerBorder[a];
        }
        if(innerBorder[a][1] == innerBB[3] && (!('bottom' in tempCoords))){
            tempCoords['bottom'] = innerBorder[a];
        }
    }

    // if(innerIndex == 34 || innerIndex == 35) { 
        // console.log(tempCoords);
    // }

    topOffset = (pixeldata.width * tempCoords['top'][1]-1 + (tempCoords['top'][0])) * 4;
    rightOffset = (pixeldata.width * tempCoords['right'][1] + (tempCoords['right'][0]+1)) * 4;
    bottomOffset = (pixeldata.width * tempCoords['bottom'][1]+1 + (tempCoords['bottom'][0])) * 4;
    leftOffset = (pixeldata.width * tempCoords['left'][1] + (tempCoords['left'][0]-1)) * 4;

    rTop = pixeldata.data[topOffset];
    rRight = pixeldata.data[rightOffset];
    rBottom = pixeldata.data[bottomOffset];
    rLeft = pixeldata.data[leftOffset];

    // offset = (pixeldata.width * tempCoords[0][1] + (tempCoords[0][0]-1)) * 4;
    // r = pixeldata.data[offset];

    if(rTop == 255 || rRight == 255 || rBottom == 255 || rLeft == 255){
        // console.log("black");
        colorOfObject = 'black';
    }else{
        //console.log("white");
        colorOfObject = 'white';
    }

    // if colorOfObject is white, skip process - it's an inner border       
    if(colorOfObject == 'black'){
        while(goalReached != true && startPointReached != true){

            if(moveSetCounter % 4 == 0){ //left
                offset = (pixeldata.width * movePoint[1] + (movePoint[0]-1)) * 4;
                r = pixeldata.data[offset];
                // console.log(r);
                if(r == 255){
                    movePoint[0]--;
                    if(moveSetCounter != 0) moveSetCounter--;
                    moved = true;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 1){ // down
                if(firstHit != true){
                    firstHit = true;
                    startPoint = [...movePoint];
                    // console.log("new Startpoint: ", startPoint);
                }
                offset = (pixeldata.width * (movePoint[1]+1) + movePoint[0]) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[1]++;
                    moveSetCounter--;
                    moved = true;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 2){ // right
                offset = (pixeldata.width * movePoint[1] + (movePoint[0]+1)) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[0]++;
                    moveSetCounter--;
                    moved = true;
                }else{
                    moveSetCounter++;
                }
            }else if(moveSetCounter % 4 == 3){ // up
                offset = (pixeldata.width * (movePoint[1]-1) + movePoint[0]) * 4;
                r = pixeldata.data[offset];

                if(r == 255){
                    movePoint[1]--;
                    moveSetCounter--;
                    moved = true;
                }else{
                    moveSetCounter++;
                }
            }
                        
            if(movePoint[0] < outerBB[0] ||
                movePoint[0] > outerBB[2] ||
                movePoint[1] < outerBB[1] ||
                movePoint[1] > outerBB[3] ) {
                    goalReached = true;
                    //console.log("Goal Reached!", startPoint);
            }

            if(movePoint[0] == startPoint[0] &&
                movePoint[1] == startPoint[1] &&
                moved) {
                    startPointReached = true;
                    //console.log("StartPoint Reached!", startPoint);
            }

            if(moveSetCounter >= 300){
                startPointReached = true;
                //console.log("Excessive movement, aborting.", startPoint);
            }

            // if(movePoint[0] < outerBB[0]) goalReached = true;
            moved = false;
        }    
    }
    // console.log('GoalReached ', goalReached);
    return goalReached
}

http.createServer(function (req, res) {
    if (req.url != '/favicon.ico') {   
        fs.readFile(__dirname + '/images/square1.png', function(err, data) {
            if (err) throw err;

            var img = new Canvas.Image; // Create a new Image
            img.src = data;
            
            var canvas = Canvas.createCanvas(img.width + extraWhitespace, img.height + extraWhitespace);
            var ctx = canvas.getContext('2d');
            
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.drawImage(img, extraWhitespace/2, extraWhitespace/2, img.width, img.height);

            var pixeldata = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Currently buggy - need other strategy - or simply discard the idea (might be a bad decision)
            // How about a fixed threshold that only get "pulled" up/down depending on specific values
            //determineNoiseThreshold(pixeldata);

            pixeldata = filterNoise(pixeldata);

            expandBorders(pixeldata);

            ctx.putImageData(pixeldata, 0, 0);

            var borders = getBorders(pixeldata);

            var borders = filterBorders(borders, pixeldata);
        
            drawBorders(ctx, borders);

            // send canvas instead of img to receive cropped images from the processed image instead of the original
            saveBordersAsImages(img, borders);

            res.write('<html><body>');
            res.write('<img src="' + canvas.toDataURL() + '" />');
            res.write('</body></html>');
            res.end();
        });
    }
}).listen(8124, "127.0.0.1");
console.log('Server running at http://127.0.0.1:8124/\n');