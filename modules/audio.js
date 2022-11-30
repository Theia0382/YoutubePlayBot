const { createAudioPlayer, createAudioResource, AudioPlayerStatus, StreamType } = require( '@discordjs/voice' );
const ytdl = require( 'ytdl-core' );
const fs = require( 'fs' );
const join = require( 'path' ).join;
const EventEmitter = require( 'events' );
const FfmpegCommand = require( 'fluent-ffmpeg' );

new FfmpegCommand( ).setFfmpegPath( join( __dirname, '../node_modules/ffmpeg-static/ffmpeg.exe' ) );

const audioPlayer = [ ];
const playlist = [ ];
const stopped = [ ];


class Audio extends EventEmitter
{
    __getAudioPlayer( guildId )
    {
        if ( !audioPlayer[ guildId ] )
        {
            audioPlayer[ guildId ] = createAudioPlayer( );

            audioPlayer[ guildId ].on( AudioPlayerStatus.Idle, ( ) =>
            {
                if( !stopped[ this.id ] )
                {
                    this._getNextResource( );
                }
            } );
        }
        
        return audioPlayer[ guildId ];
    }
    
    __getPlaylist( guildId )
    {
        if ( !playlist[ guildId ] )
        {
            playlist[ guildId ] = [ ];
        }
    
        return playlist[ guildId ];
    }


    constructor( guildId )
    {
        super( );
        this.id = guildId;
        this.player = this.__getAudioPlayer( guildId );
        this.playlist = this.__getPlaylist( guildId );
        stopped[ this.id ] = false;
    }

    _play( )
    {
        if( !this.playlist[ 0 ] )
        {
            const error = new Error( );
            error.message = '재생목록이 비어있습니다.';
            error.code = 'noplaylist';
            this.emit( 'error', error );
            return;
        }

        stopped[ this.id ] = false;

        const download = ytdl( this.playlist[ 0 ].url, { filter : format => format.container === 'mp4', quality : 'highestaudio' } );

        new FfmpegCommand( download )
            .noVideo( )
            .audioCodec('libopus')
            .audioFilters('volume=0.1')
            .format('ogg')
            .pipe( fs.createWriteStream( join( __dirname, `../temp/${ this.id }.ogg` ) ) )
            .on( 'finish', ( ) =>
            {
                const stream = fs.createReadStream( join( __dirname, `../temp/${ this.id }.ogg` ) );
                const resource = createAudioResource( stream, { inputType : StreamType.OggOpus } );
                this.player.play( resource );

                this.emit( 'playing' );
                return;
            } );
    }

    _getNextResource( )
    {
        this.playlist.shift( );

        if( this.playlist[ 0 ] )
        {
            this._play( );
            return;
        }
        else
        {
            this.stop( );
            return;
        }
    }

    play( url )
    {
        if( url )
        {
            if ( ytdl.validateURL( url ) )
            {
                ytdl.getBasicInfo( url, { lang : 'kr' } ).then( ( videoInfo ) =>
                {
                    this.playlist.unshift(
                    { 
                        url : url,
                        info : videoInfo.videoDetails
                    } );

                    this._play( );
                    return;
                } );
            }
            else
            {
                const error = new Error( );
                error.message = `${ url } 에서 비디오 ID를 찾을 수 없습니다.`;
                error.code = 'invalidurl';
                this.emit( 'error', error );
                return;
            }
        }
        else
        {
            this._play( );
            return;
        }
    }

    add( url )
    {
        if ( ytdl.validateURL( url ) )
        {
            ytdl.getBasicInfo( url, { lang : 'kr' } ).then( ( videoInfo ) =>
            {
                this.playlist.push(
                { 
                    url : url,
                    info : videoInfo.videoDetails
                } );

                this.emit( 'added' );
                return;
            } );
        }
        else
        {
            const error = new Error( );
            error.message = `${ url } 에서 비디오 ID를 찾을 수 없습니다.`;
            error.code = 'invalidurl';
            this.emit( 'error', error );
            return;
        }
    }

    pause( )
    {
        if( this.player.pause( ) )
        {
            this.emit( 'pause' );
            return;
        }
        else
        {
            this.emit( 'cannotpause' );
            return;
        }
    }

    unpause( )
    {
        if( this.player.unpause( ) )
        {
            this.emit( 'unpause' );
            return;
        }
        else
        {
            this.emit( 'cannotunpause' );
            return;
        }
    }

    skip( )
    {
        this._getNextResource( );
        return;
    }

    stop( )
    {
        stopped[ this.id ] = true;
        this.player.stop( );
        this.emit( 'stopped' );
        return;
    }

    reset( )
    {
        this.playlist.length = 0;
        this.stop( );
        this.emit( 'reset' );
        return;
    }
}

module.exports = Audio;